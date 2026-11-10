// ================================================================
// /api/erp?r=<resource> — UXONIC ERP API (one Vercel function; the
// Hobby plan allows 12). Logic lives in api/_lib/erp/*.
//
// Who can call:
//   public            auth-send, auth-verify (OTP login)
//   cron              cron (Vercel Cron with CRON_SECRET, or an admin)
//   staff (ERP app)   role-checked per resource — see _lib/erp/auth.js
//   employee portal   me, me-checkin, me-checkout, me-leaves, me-payslip, me-timesheet, me-tasks
//   client portal     portal, portal-invoice, portal-quote
// Every successful change is written to the audit log.
// ================================================================
import { getSupabase } from './_lib/supabase.js';
import { handleOptions, json } from './_lib/cors.js';
import { HttpError, today } from './_lib/erp/core.js';
import { resolveActor, staffCan, allowedResources, authSend, authVerify } from './_lib/erp/auth.js';
import { employees, attendance, timesheets, leaves, advances, payroll } from './_lib/erp/people.js';
import { products, members, tasks } from './_lib/erp/work.js';
import { clients, invoices, payments, quotes, recurring, expenses, runDueRecurring, sendDueReminders } from './_lib/erp/sales.js';
import { settings, dashboard, reports, gst, users, audit, backup, writeAudit } from './_lib/erp/insights.js';
import { employeePortal, clientPortal } from './_lib/erp/portal.js';

const STAFF = {
  dashboard, settings, employees, attendance, timesheets, leaves, advances, payroll,
  products, members, tasks, clients, invoices, payments, quotes, recurring, expenses,
  reports, gst, users, audit, backup,
};
const EMPLOYEE = new Set(['me', 'me-checkin', 'me-checkout', 'me-leaves', 'me-payslip', 'me-timesheet', 'me-tasks']);
const CLIENT = new Set(['portal', 'portal-invoice', 'portal-quote']);

const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

async function runCron(sb) {
  const day = today();
  const created = await runDueRecurring(sb, day);
  const reminded = await sendDueReminders(sb, day);
  return { day, recurring_created: created, reminders_sent: reminded, message: `Cron: ${created.length} recurring invoice(s), ${reminded.length} reminder(s).` };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const q = req.query || {};
  const r = String(q.r || '');
  const method = req.method;
  const body = req.body || {};
  const ip = ipOf(req);
  let sb;
  try { sb = getSupabase(); } catch (e) { return json(res, 500, { success: false, message: e.message }, req); }

  try {
    // ---------- public: OTP login ----------
    if (r === 'auth-send' && method === 'POST') return json(res, 200, { success: true, ...(await authSend({ sb, body, ip })) }, req);
    if (r === 'auth-verify' && method === 'POST') {
      const out = await authVerify({ sb, body, ip });
      await writeAudit(sb, { actor: out._audit.actor, actor_role: out._audit.role, action: 'login', resource: 'auth', summary: out._audit.summary, ip });
      delete out._audit;
      return json(res, 200, { success: true, ...out }, req);
    }

    // ---------- cron (Vercel sends Authorization: Bearer $CRON_SECRET) ----------
    if (r === 'cron') {
      const secret = process.env.CRON_SECRET;
      const auth = req.headers['authorization'] || '';
      let ok = !!secret && auth === `Bearer ${secret}`;
      if (!ok) {
        const a = await resolveActor(req, sb);
        ok = a?.kind === 'staff' && a.role === 'admin';
      }
      if (!ok) throw new HttpError(401, 'Unauthorised.');
      const out = await runCron(sb);
      await writeAudit(sb, { actor: 'cron', actor_role: 'system', action: 'cron', resource: 'cron', summary: out.message, ip });
      return json(res, 200, { success: true, ...out }, req);
    }

    // ---------- signed-in callers ----------
    const actor = await resolveActor(req, sb);
    if (!actor) throw new HttpError(401, 'Please sign in again.');

    let data;
    if (actor.kind === 'employee') {
      if (!EMPLOYEE.has(r)) throw new HttpError(403, 'Not available in the employee portal.');
      data = await employeePortal({ sb, method, q, body, actor, resource: r });
    } else if (actor.kind === 'client') {
      if (!CLIENT.has(r)) throw new HttpError(403, 'Not available in the client portal.');
      data = await clientPortal({ sb, method, q, body, actor, resource: r });
    } else {
      if (r === 'whoami') {
        return json(res, 200, { success: true, user: { name: actor.name, email: actor.email, role: actor.role }, access: allowedResources(actor.role) }, req);
      }
      const fn = STAFF[r];
      if (!fn) throw new HttpError(404, 'Unknown ERP resource.');
      if (!staffCan(actor.role, r, method)) throw new HttpError(403, `Your role (${actor.role}) cannot ${method === 'GET' ? 'view' : 'change'} ${r}.`);
      data = await fn({ sb, method, q, body, actor });
    }

    if (method !== 'GET') {
      const recordId = q.id || data?.invoice?.id || data?.quote?.id || data?.employee?.id || data?.client?.id || data?.product?.id ||
        data?.leave?.id || data?.task?.id || data?.expense?.id || data?.recurring?.id || null;
      await writeAudit(sb, {
        actor: actor.email || actor.name, actor_role: actor.role, action: method + (q.action ? ':' + q.action : ''),
        resource: r, record_id: recordId != null ? String(recordId) : null, summary: String(data?.message || '').slice(0, 500), ip,
      });
    }
    return json(res, 200, { success: true, ...data }, req);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[erp]', r, err);
    return json(res, status, { success: false, message: err.message || 'Server error.' }, req);
  }
}
