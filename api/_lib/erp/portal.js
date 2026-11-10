// Self-service portals: employees (/erp/me) and clients (/erp/client).
// Every query here is scoped to the signed-in employee / client id.
import { C, must, clean, bad, conflict, forbidden, idOf, today, getSettings, methodNotAllowed } from './core.js';
import { leaveBalance, createLeave, decideLeave, saveTimesheet } from './people.js';
import { taskProgress } from './work.js';
import { convertQuote, portalLink } from './sales.js';

// ================================================================ EMPLOYEE PORTAL
export async function employeePortal({ sb, method, q, body, actor, resource }) {
  const me = actor.employee;
  const s = await getSettings(sb);
  const t = today();

  if (resource === 'me' && method === 'GET') {
    const { first, last } = C.monthRange(t.slice(0, 7));
    const [todayRow, monthAtt, leaves, tasks, members, payslips, ts] = await Promise.all([
      sb.from('erp_attendance').select('*').eq('employee_id', me.id).eq('date', t).maybeSingle().then((r) => r.data),
      sb.from('erp_attendance').select('date, status').eq('employee_id', me.id).gte('date', first).lte('date', last).then(must),
      sb.from('erp_leaves').select('*').eq('employee_id', me.id).order('from_date', { ascending: false }).limit(30).then(must),
      sb.from('erp_tasks').select('*, erp_products(name)').eq('assignee_id', me.id).neq('status', 'done').order('due_date').then(must),
      sb.from('erp_product_members').select('role, product_id, erp_products(id, name, status)').eq('employee_id', me.id).then(must),
      sb.from('erp_payroll').select('id, month, net_pay, status, paid_on').eq('employee_id', me.id).order('month', { ascending: false }).then(must),
      sb.from('erp_timesheets').select('*').eq('employee_id', me.id).eq('date', t).then(must),
    ]);
    const isOff = (s.weekly_off || []).includes(C.parseYmd(t).getDay());
    return {
      profile: { id: me.id, name: me.full_name, emp_code: me.emp_code, designation: me.designation, email: me.email },
      today: t, is_weekly_off: isOff, attendance_today: todayRow,
      month: {
        present: monthAtt.filter((a) => a.status === 'present').length,
        half: monthAtt.filter((a) => a.status === 'half-day').length,
        leave: monthAtt.filter((a) => a.status === 'leave').length,
        absent: monthAtt.filter((a) => a.status === 'absent').length,
      },
      leave_balance: await leaveBalance(sb, me, s), leaves, tasks,
      products: members.map((m) => ({ id: m.product_id, name: m.erp_products?.name, role: m.role, status: m.erp_products?.status })).filter((p) => p.status !== 'completed'),
      payslips: payslips.filter((p) => p.status === 'paid'),
      timesheet_today: ts,
    };
  }

  if (resource === 'me-checkin' && method === 'POST') {
    const row = (await sb.from('erp_attendance').select('*').eq('employee_id', me.id).eq('date', t).maybeSingle()).data;
    if (row && row.check_in) throw conflict(`Already checked in at ${row.check_in}.`);
    if (row && row.source === 'leave') throw conflict('You are on approved leave today.');
    const locked = must(await sb.from('erp_payroll').select('id').eq('employee_id', me.id).eq('month', t.slice(0, 7) + '-01').eq('status', 'paid'));
    if (locked.length) throw conflict('Payroll for this month is already closed.');
    const time = C.istTime();
    if (row) must(await sb.from('erp_attendance').update({ check_in: time }).eq('id', row.id));
    else {
      const product_id = body?.product_id ? parseInt(body.product_id, 10) : null;
      must(await sb.from('erp_attendance').insert({ employee_id: me.id, date: t, status: 'present', product_id, check_in: time, source: 'self' }));
    }
    return { message: `Checked in at ${time}. Have a great day!`, time };
  }

  if (resource === 'me-checkout' && method === 'POST') {
    const row = (await sb.from('erp_attendance').select('*').eq('employee_id', me.id).eq('date', t).maybeSingle()).data;
    if (!row || !row.check_in) throw conflict('Check in first.');
    if (row.check_out) throw conflict(`Already checked out at ${row.check_out}.`);
    const time = C.istTime();
    const [h1, m1] = row.check_in.split(':').map(Number), [h2, m2] = time.split(':').map(Number);
    const hours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    const upd = { check_out: time };
    // under 4.5 hours on a self-marked day counts as a half day
    if (row.source === 'self' && hours < 4.5) upd.status = 'half-day';
    must(await sb.from('erp_attendance').update(upd).eq('id', row.id));
    return { message: `Checked out at ${time} (${C.round2(Math.max(0, hours))} h).${upd.status === 'half-day' ? ' Marked as half day.' : ''}`, time };
  }

  if (resource === 'me-leaves') {
    if (method === 'POST') return createLeave(sb, me.id, body, { autoApprove: false, actor: me.email || me.full_name });
    if (method === 'DELETE') {
      const lv = must(await sb.from('erp_leaves').select('*').eq('id', idOf(q)).single());
      if (lv.employee_id !== me.id) throw forbidden();
      if (lv.status !== 'pending') throw conflict('Only pending requests can be withdrawn. Ask HR to cancel an approved leave.');
      await decideLeave(sb, lv.id, 'cancelled', me.email || me.full_name);
      return { message: 'Leave request withdrawn.' };
    }
  }

  if (resource === 'me-payslip' && method === 'GET') {
    const p = must(await sb.from('erp_payroll').select('*, erp_employees(*)').eq('id', idOf(q)).single());
    if (p.employee_id !== me.id || p.status !== 'paid') throw forbidden();
    return { payslip: p, settings: s };
  }

  if (resource === 'me-timesheet') {
    const allowed = new Set(must(await sb.from('erp_product_members').select('product_id').eq('employee_id', me.id)).map((m) => m.product_id));
    if (method === 'GET') {
      const date = q.date || t;
      return { entries: must(await sb.from('erp_timesheets').select('*, erp_products(name)').eq('employee_id', me.id).eq('date', date)) };
    }
    if (method === 'POST') {
      const date = body?.date || t;
      if (date > t) throw bad('You cannot log hours for a future date.');
      if (date < C.addDays(t, -7)) throw bad('Timesheets older than 7 days can only be changed by HR.');
      const entries = (body.entries || []).filter((e) => Number(e.hours) > 0);
      if (entries.some((e) => !allowed.has(parseInt(e.product_id, 10)))) throw forbidden('You can only log time on products you are assigned to.');
      return saveTimesheet(sb, me.id, date, entries);
    }
  }

  if (resource === 'me-tasks' && method === 'PUT') {
    const task = must(await sb.from('erp_tasks').select('*').eq('id', idOf(q)).single());
    if (task.assignee_id !== me.id) throw forbidden();
    const { status } = clean(body, { status: 'enum:todo|doing|review|done' });
    must(await sb.from('erp_tasks').update({ status }).eq('id', task.id));
    return { message: 'Task updated.' };
  }
  throw methodNotAllowed();
}

// ================================================================ CLIENT PORTAL
export async function clientPortal({ sb, method, q, body, actor, resource }) {
  const me = actor.client;
  const s = await getSettings(sb);
  const t = today();

  if (resource === 'portal' && method === 'GET') {
    const [invs, quotes, prods] = await Promise.all([
      sb.from('erp_invoices').select('id, invoice_no, issue_date, due_date, total, amount_paid, status').eq('client_id', me.id).neq('status', 'draft').order('issue_date', { ascending: false }).then(must),
      sb.from('erp_quotes').select('id, quote_no, issue_date, valid_until, total, status').eq('client_id', me.id).neq('status', 'draft').order('issue_date', { ascending: false }).then(must),
      sb.from('erp_products').select('id, name, status, start_date, end_date').eq('client_id', me.id).then(must),
    ]);
    invs.forEach((i) => { i.effective_status = C.invoiceStatus(i, t); });
    const projects = [];
    for (const p of prods) {
      const tasks = must(await sb.from('erp_tasks').select('id, title, status, due_date, is_milestone').eq('product_id', p.id).eq('client_visible', true).order('due_date'));
      projects.push({ ...p, progress: taskProgress(tasks), milestones: tasks.filter((x) => x.is_milestone), recent_done: tasks.filter((x) => x.status === 'done').slice(-5) });
    }
    const open = invs.filter((i) => ['sent', 'partially-paid'].includes(i.status));
    return {
      client: { id: me.id, name: me.name, company: me.company, email: me.email },
      company: { name: s.company_name, email: s.email, phone: s.phone, bank_name: s.bank_name, bank_account: s.bank_account, bank_ifsc: s.bank_ifsc, upi_id: s.upi_id },
      invoices: invs, quotes, projects,
      balance_due: C.round2(open.reduce((a, i) => a + Number(i.total) - Number(i.amount_paid), 0)),
    };
  }

  if (resource === 'portal-invoice' && method === 'GET') {
    const id = idOf(q);
    const invoice = must(await sb.from('erp_invoices').select('*, erp_clients(*), erp_products(id, name)').eq('id', id).single());
    if (invoice.client_id !== me.id || invoice.status === 'draft') throw forbidden();
    const [items, payments] = await Promise.all([
      sb.from('erp_invoice_items').select('*').eq('invoice_id', id).order('position').then(must),
      sb.from('erp_payments').select('paid_on, amount, mode').eq('invoice_id', id).order('paid_on').then(must),
    ]);
    invoice.effective_status = C.invoiceStatus(invoice, t);
    return { invoice, items, payments, settings: s };
  }

  if (resource === 'portal-quote') {
    const id = idOf(q);
    const quote = must(await sb.from('erp_quotes').select('*, erp_clients(*), erp_products(id, name)').eq('id', id).single());
    if (quote.client_id !== me.id || quote.status === 'draft') throw forbidden();
    if (method === 'GET') {
      const items = must(await sb.from('erp_quote_items').select('*').eq('quote_id', id).order('position'));
      quote.expired = quote.status === 'sent' && quote.valid_until && quote.valid_until < t;
      return { quote, items, settings: s };
    }
    if (method === 'POST') {
      const { decision } = clean(body, { decision: 'enum:accepted|rejected' });
      if (quote.status !== 'sent') throw conflict(`This quotation is already ${quote.status}.`);
      if (quote.valid_until && quote.valid_until < t) throw conflict('This quotation has expired. Please contact us for a fresh one.');
      must(await sb.from('erp_quotes').update({ status: decision }).eq('id', id));
      return { message: decision === 'accepted' ? 'Thank you! We have received your acceptance and will be in touch shortly.' : 'Quotation declined. Thanks for letting us know.' };
    }
  }
  throw methodNotAllowed();
}

export { portalLink, convertQuote };
