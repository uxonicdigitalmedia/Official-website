// ERP authentication: OTP login for staff, employees and clients + role checks.
//
// Token kinds (each signed with its own derived secret, so a portal token can
// never be used against the admin panel or the staff ERP):
//   admin panel token (existing /admin login)  → ERP owner, role "admin"
//   staff    → erp_users (roles admin | hr | accountant), or ADMIN_EMAIL as owner
//   employee → erp_employees (employee portal /erp/me)
//   client   → erp_clients   (client portal  /erp/client)
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken } from '../auth.js';
import { sendEmail } from '../email.js';
import { must, bad, HttpError } from './core.js';

const BASE = process.env.ADMIN_JWT_SECRET || 'fallback_dev_secret_change_in_prod';
const OWNER_EMAIL = (process.env.ADMIN_EMAIL || 'uxonicdigitalmedia@gmail.com').toLowerCase();
const secretFor = (kind) => crypto.createHash('sha256').update(`${BASE}|erp-${kind}`).digest('hex');
const TTL = { staff: '12h', employee: '30d', client: '30d' };
const KINDS = ['staff', 'employee', 'client'];

export function signErpToken(kind, payload) {
  return jwt.sign({ ...payload, kind }, secretFor(kind), { expiresIn: TTL[kind] });
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : h;
}

/**
 * Who is calling? Returns
 *   { kind:'staff', role, name, email, id } | { kind:'employee', employee } | { kind:'client', client } | null
 */
export async function resolveActor(req, sb) {
  const token = bearer(req);
  if (!token) return null;

  const admin = verifyToken(token); // existing admin-panel token → owner
  if (admin.valid) return { kind: 'staff', role: 'admin', name: admin.payload.name || 'UXONIC Admin', email: admin.payload.email || OWNER_EMAIL, id: 0 };

  for (const kind of KINDS) {
    let p;
    try { p = jwt.verify(token, secretFor(kind)); } catch { continue; }
    if (kind === 'staff') {
      if (p.sub === 0) return { kind, role: 'admin', name: 'UXONIC Admin', email: OWNER_EMAIL, id: 0 };
      const u = (await sb.from('erp_users').select('*').eq('id', p.sub).maybeSingle()).data;
      if (!u || !u.active) return null;
      return { kind, role: u.role, name: u.full_name, email: u.email, id: u.id };
    }
    if (kind === 'employee') {
      const e = (await sb.from('erp_employees').select('*').eq('id', p.sub).maybeSingle()).data;
      if (!e || e.status !== 'active' || e.portal_enabled === false) return null;
      return { kind, employee: e, name: e.full_name, email: e.email, role: 'employee' };
    }
    if (kind === 'client') {
      const c = (await sb.from('erp_clients').select('*').eq('id', p.sub).maybeSingle()).data;
      if (!c || c.portal_enabled === false) return null;
      return { kind, client: c, name: c.company || c.name, email: c.email, role: 'client' };
    }
  }
  return null;
}

// ---------------- role → resource access for staff ----------------
const ALL = ['admin', 'hr', 'accountant'];
const RULES = {
  whoami: { read: ALL, write: [] },
  dashboard: { read: ALL, write: [] },
  settings: { read: ALL, write: ['admin'] },
  employees: { read: ALL, write: ['admin', 'hr'] },
  attendance: { read: ['admin', 'hr'], write: ['admin', 'hr'] },
  timesheets: { read: ['admin', 'hr'], write: ['admin', 'hr'] },
  leaves: { read: ['admin', 'hr'], write: ['admin', 'hr'] },
  advances: { read: ['admin', 'hr', 'accountant'], write: ['admin', 'hr'] },
  payroll: { read: ALL, write: ALL },
  products: { read: ALL, write: ALL },
  members: { read: ALL, write: ALL },
  tasks: { read: ALL, write: ALL },
  clients: { read: ['admin', 'accountant', 'hr'], write: ['admin', 'accountant'] },
  invoices: { read: ['admin', 'accountant'], write: ['admin', 'accountant'] },
  payments: { read: ['admin', 'accountant'], write: ['admin', 'accountant'] },
  quotes: { read: ['admin', 'accountant'], write: ['admin', 'accountant'] },
  recurring: { read: ['admin', 'accountant'], write: ['admin', 'accountant'] },
  expenses: { read: ['admin', 'accountant'], write: ['admin', 'accountant'] },
  reports: { read: ['admin', 'accountant'], write: [] },
  gst: { read: ['admin', 'accountant'], write: [] },
  users: { read: ['admin'], write: ['admin'] },
  audit: { read: ['admin'], write: [] },
  backup: { read: ['admin'], write: [] },
  cron: { read: ['admin'], write: ['admin'] },
};
export function staffCan(role, resource, method) {
  const r = RULES[resource];
  if (!r) return false;
  return (method === 'GET' ? r.read : r.write).includes(role);
}
export function allowedResources(role) {
  return Object.keys(RULES).filter((k) => RULES[k].read.includes(role) || RULES[k].write.includes(role));
}
export const canWrite = (role, resource) => !!RULES[resource]?.write.includes(role);

// ---------------- OTP login (public) ----------------
const sendLimiter = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const r = sendLimiter.get(key) || { n: 0, t: now };
  if (now - r.t > windowMs) { r.n = 0; r.t = now; }
  r.n++; sendLimiter.set(key, r);
  return r.n > max;
}
const hash = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const GENERIC = 'If this email is registered, a 6-digit code has been sent. It expires in 10 minutes.';

async function findAccount(sb, kind, email) {
  if (kind === 'staff') {
    if (email === OWNER_EMAIL) return { id: 0, name: 'UXONIC Admin', role: 'admin' };
    const u = (await sb.from('erp_users').select('*').ilike('email', email).maybeSingle()).data;
    return u && u.active ? { id: u.id, name: u.full_name, role: u.role } : null;
  }
  if (kind === 'employee') {
    const list = must(await sb.from('erp_employees').select('*').ilike('email', email));
    const e = list.find((x) => x.status === 'active' && x.portal_enabled !== false);
    return e ? { id: e.id, name: e.full_name } : null;
  }
  const list = must(await sb.from('erp_clients').select('*').ilike('email', email));
  const c = list.find((x) => x.portal_enabled !== false);
  return c ? { id: c.id, name: c.company || c.name } : null;
}

const PORTAL_NAME = { staff: 'UXONIC ERP', employee: 'UXONIC Employee Portal', client: 'UXONIC Client Portal' };

export async function authSend({ sb, body, ip }) {
  const kind = String(body?.kind || '');
  const email = String(body?.email || '').trim().toLowerCase();
  if (!KINDS.includes(kind)) throw bad('Unknown login type.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address.');
  if (limited('ip|' + ip, 10, 3600_000) || limited('em|' + email, 5, 3600_000)) throw new HttpError(429, 'Too many requests. Please wait and try again.');

  const acct = await findAccount(sb, kind, email);
  if (!acct) return { message: GENERIC }; // don't reveal which emails exist

  const otp = String(crypto.randomInt(100000, 1000000));
  must(await sb.from('erp_otps').insert({ kind, email, otp_hash: hash(otp), expires_at: new Date(Date.now() + 10 * 60000).toISOString() }));
  const sent = await sendEmail({
    to: email,
    subject: `${otp} is your ${PORTAL_NAME[kind]} login code`,
    text: `Your login code is ${otp}. It expires in 10 minutes.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:440px;margin:auto;padding:28px;border:1px solid #E8E7E1;border-radius:16px">
      <h2 style="margin:0 0 6px;color:#111114">${PORTAL_NAME[kind]}</h2>
      <p style="color:#4E4E58;margin:0 0 18px">Hi ${String(acct.name).replace(/</g, '&lt;')}, use this code to sign in:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F0EBFF;color:#111114;padding:16px;border-radius:12px;text-align:center">${otp}</div>
      <p style="color:#8C8C95;font-size:13px;margin-top:18px">Expires in 10 minutes. If you didn't request this, you can ignore this email.</p></div>`,
  });
  if (!sent.ok) console.error('[erp auth] OTP email failed:', sent.error);
  return { message: GENERIC };
}

export async function authVerify({ sb, body, ip }) {
  const kind = String(body?.kind || '');
  const email = String(body?.email || '').trim().toLowerCase();
  const otp = String(body?.otp || '').replace(/\D/g, '');
  if (!KINDS.includes(kind) || !email || otp.length !== 6) throw bad('Enter the 6-digit code.');
  if (limited('v|' + ip, 20, 600_000)) throw new HttpError(429, 'Too many attempts. Wait 10 minutes.');

  const rows = must(await sb.from('erp_otps').select('*').eq('kind', kind).eq('email', email).eq('used', false)
    .order('created_at', { ascending: false }).limit(1));
  const rec = rows[0];
  if (!rec || new Date(rec.expires_at) < new Date()) throw new HttpError(401, 'Code expired. Request a new one.');
  if (rec.attempts >= 5) throw new HttpError(401, 'Too many wrong attempts. Request a new code.');
  if (rec.otp_hash !== hash(otp)) {
    await sb.from('erp_otps').update({ attempts: rec.attempts + 1 }).eq('id', rec.id);
    throw new HttpError(401, 'Wrong code. Please check and try again.');
  }
  await sb.from('erp_otps').update({ used: true }).eq('id', rec.id);
  await sb.from('erp_otps').delete().lt('expires_at', new Date(Date.now() - 86400_000).toISOString());

  const acct = await findAccount(sb, kind, email);
  if (!acct) throw new HttpError(401, 'This account is not active.');
  if (kind === 'staff' && acct.id) await sb.from('erp_users').update({ last_login: new Date().toISOString() }).eq('id', acct.id);
  const token = signErpToken(kind, { sub: acct.id, email, name: acct.name, role: acct.role });
  return { token, profile: { kind, id: acct.id, name: acct.name, email, role: acct.role || kind }, _audit: { actor: email, role: kind, summary: `${kind} login` } };
}
