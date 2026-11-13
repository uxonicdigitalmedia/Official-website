// POST /api/admin/books — Admin → UXONIC Books.
// The website admin (OTP login) is the only way in. This function calls the
// UXONIC Books database's platform_* functions with a private server key
// (BOOKS_PLATFORM_KEY, sent as the x-platform-key header). The database keeps
// only that key's SHA-256 and refuses every call without it. The key never
// reaches the browser.
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { sendEmail } from '../_lib/email.js';

const SUPPORT_EMAIL = 'info@uxonicdigital.com';
const APP_URL = (process.env.BOOKS_APP_URL || 'https://books.uxonicdigital.com').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The customer gets UXONIC's reply by email too (and in the app: Help → their message).
async function emailReply(to, info, body) {
  const link = APP_URL + info.link;
  const first = info.name ? info.name.split(' ')[0] : '';
  return sendEmail({
    to,
    reply_to: SUPPORT_EMAIL,
    subject: `Re: ${info.subject}`,
    text: `${first ? `Hi ${first},` : 'Hi,'}\n\n${body}\n\nReply in UXONIC Books: ${link}\n\nUXONIC Support · ${SUPPORT_EMAIL} · +91 98430 21717`,
    html: `<!doctype html><html><body style="margin:0;background:#FAFAF7;font-family:Inter,Arial,sans-serif;color:#111114"><div style="max-width:540px;margin:0 auto;padding:36px 24px">
      <p style="font-weight:700;letter-spacing:.12em;margin:0 0 24px">UXONIC</p>
      <p style="margin:0 0 14px">${first ? `Hi ${esc(first)},` : 'Hi,'}</p>
      <p style="margin:0 0 14px;line-height:1.6;white-space:pre-wrap">${esc(body)}</p>
      <p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#111114;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Open the conversation</a></p>
      <p style="margin:28px 0 0;color:#85858F;font-size:12px">About: ${esc(info.subject)} · ${esc(info.org_name)}<br>UXONIC Support · ${SUPPORT_EMAIL} · +91 98430 21717</p>
    </div></body></html>`,
  });
}

// Only these functions can be reached through the admin panel.
const ALLOWED = new Set([
  'platform_overview', 'platform_orgs', 'platform_org', 'platform_update_subscription',
  'platform_record_payment', 'platform_set_payment_status', 'platform_set_org_status',
  'platform_payments', 'platform_plans', 'platform_save_plan', 'platform_save_settings',
  'platform_tickets', 'platform_ticket', 'platform_reply_ticket', 'platform_set_ticket_status',
]);

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
  if (!requireAuth(req, res)) return;

  const url = process.env.BOOKS_SUPABASE_URL;
  const anonKey = process.env.BOOKS_PUBLISHABLE_KEY;
  const serverKey = process.env.BOOKS_PLATFORM_KEY;
  if (!url || !anonKey || !serverKey) {
    return json(res, 503, { success: false, message: 'UXONIC Books is not connected yet: BOOKS_SUPABASE_URL, BOOKS_PUBLISHABLE_KEY and BOOKS_PLATFORM_KEY are missing on the server.' }, req);
  }

  const { fn, args } = req.body || {};
  if (!ALLOWED.has(fn)) return json(res, 400, { success: false, message: 'Unknown action.' }, req);
  if (args !== undefined && (typeof args !== 'object' || Array.isArray(args) || args === null)) {
    return json(res, 400, { success: false, message: 'Invalid arguments.' }, req);
  }

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', 'x-platform-key': serverKey },
      body: JSON.stringify(args || {}),
    });
    const text = await r.text();
    const body = text ? JSON.parse(text) : null;
    if (!r.ok) {
      // Postgres errors come back as { code, message, hint }; message is a short code like "invalid_input".
      const missing = body?.code === 'PGRST202' || /Could not find the function/.test(body?.message || '');
      return json(res, missing ? 501 : r.status === 401 || r.status === 403 ? 403 : 400, {
        success: false,
        code: body?.message || 'error',
        hint: body?.hint || null,
        message: missing ? 'The UXONIC Books database is not updated yet. Run: npx supabase db push' : body?.message || 'Request failed.',
      }, req);
    }
    if (fn === 'platform_reply_ticket' && body?.email) {
      const mail = await emailReply(body.email, body, String(args?.p_body || ''));
      return json(res, 200, { success: true, data: { ...body, emailed: !!mail.ok } }, req);
    }
    return json(res, 200, { success: true, data: body }, req);
  } catch (err) {
    console.error('admin/books exception:', err);
    return json(res, 502, { success: false, message: 'Could not reach UXONIC Books. Please try again.' }, req);
  }
}
