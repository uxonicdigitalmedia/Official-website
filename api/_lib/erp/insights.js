// Dashboard, P&L reports, GST report, settings, staff users, audit log, backup
import { C, must, clean, bad, conflict, idOf, today, employedOn, getSettings, invoiceMoney, workCost, MONTH_RE, methodNotAllowed } from './core.js';

// ================================================================ SETTINGS
const SETTINGS_SPEC = {
  company_name: 'text!', address: 'text', state: 'text', state_code: 'text', gstin: 'text', pan: 'text',
  email: 'text', phone: 'text', website: 'text', bank_name: 'text', bank_account: 'text', bank_ifsc: 'text',
  upi_id: 'text', invoice_prefix: 'text!', quote_prefix: 'text', default_gst_rate: 'num', invoice_terms: 'text',
  weekly_off: 'intarr', leave_casual: 'num', leave_sick: 'num', pf_enabled: 'bool', esi_enabled: 'bool',
  auto_reminders: 'bool', reminder_every_days: 'int', portal_url: 'text',
};
export async function settings({ sb, method, body }) {
  if (method === 'GET') return { settings: await getSettings(sb) };
  if (method === 'PUT') {
    await getSettings(sb);
    const data = must(await sb.from('erp_settings').update(clean(body, SETTINGS_SPEC, { partial: true })).eq('id', 1).select('*').single());
    return { settings: data, message: 'Settings saved.' };
  }
  throw methodNotAllowed();
}

// ================================================================ DASHBOARD
export async function dashboard({ sb, actor }) {
  const out = await dashboardData(sb);
  if (actor?.role === 'hr') { out.invoices = null; out.month_pnl = null; } // HR doesn't see money in/out
  return out;
}

async function dashboardData(sb) {
  const t = today();
  const month = t.slice(0, 7);
  const { first, last } = C.monthRange(month);
  const fyStart = `${C.financialYear(t).slice(0, 4)}-04-01`;

  const [emps, todayAtt, payrollRows, invs, pays, prods, clientsCount, exps, pendingLeaves, openTasks, quotes] = await Promise.all([
    sb.from('erp_employees').select('id, status, join_date, exit_date, monthly_salary').then(must),
    sb.from('erp_attendance').select('employee_id, status, check_in').eq('date', t).then(must),
    sb.from('erp_payroll').select('net_pay, status').eq('month', first).then(must),
    sb.from('erp_invoices').select('id, invoice_no, issue_date, due_date, total, amount_paid, status, erp_clients(name)').order('issue_date', { ascending: false }).then(must),
    sb.from('erp_payments').select('amount, paid_on').gte('paid_on', fyStart).then(must),
    sb.from('erp_products').select('id, name, status').then(must),
    sb.from('erp_clients').select('id', { count: 'exact', head: true }),
    sb.from('erp_expenses').select('amount, gst_amount, date').gte('date', first).lte('date', last).then(must),
    sb.from('erp_leaves').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('erp_tasks').select('id, due_date, status').neq('status', 'done').then(must),
    sb.from('erp_quotes').select('id, status, total').in('status', ['sent', 'accepted']).then(must),
  ]);

  const activeAll = emps.filter((e) => e.status === 'active');
  const active = activeAll.filter((e) => employedOn(e, t, t));
  const counts = { present: 0, 'half-day': 0, absent: 0, leave: 0, holiday: 0 };
  todayAtt.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
  const markedToday = new Set(todayAtt.map((a) => a.employee_id));

  invs.forEach((i) => { i.effective_status = C.invoiceStatus(i, t); });
  const open = invs.filter((i) => ['sent', 'partially-paid'].includes(i.status));
  const overdue = invs.filter((i) => i.effective_status === 'overdue');
  const receivedMonth = C.round2(pays.filter((p) => p.paid_on >= first && p.paid_on <= last).reduce((s, p) => s + Number(p.amount), 0));
  const expensesMonth = C.round2(exps.reduce((s, x) => s + Number(x.amount) - Number(x.gst_amount), 0));
  const payrollMonth = C.round2(payrollRows.reduce((s, r) => s + Number(r.net_pay), 0));

  const effortMap = await workCost(sb, { from: first, to: last });
  const productEffort = prods.map((p) => ({ id: p.id, name: p.name, status: p.status, days: effortMap.get(p.id)?.days || 0 }))
    .filter((p) => p.days > 0).sort((a, b) => b.days - a.days).slice(0, 6);

  return {
    today: t, month,
    employees: {
      active: activeAll.length,
      expected_today: new Set([...active.map((e) => e.id), ...markedToday]).size,
      total: emps.length,
      monthly_salary_total: C.round2(activeAll.reduce((s, e) => s + Number(e.monthly_salary), 0)),
      self_checked_in: todayAtt.filter((a) => a.check_in).length,
    },
    attendance: { ...counts, unmarked: active.filter((e) => !markedToday.has(e.id)).length },
    payroll: {
      generated: payrollRows.length, total: payrollMonth,
      paid: C.round2(payrollRows.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.net_pay), 0)),
    },
    invoices: {
      outstanding: C.round2(open.reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0)),
      overdue_count: overdue.length,
      invoiced_fy: C.round2(invs.filter((i) => i.issue_date >= fyStart && !['draft', 'cancelled'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0)),
      received_month: receivedMonth, received_fy: C.round2(pays.reduce((s, p) => s + Number(p.amount), 0)),
      recent: invs.slice(0, 6), overdue: overdue.slice(0, 6),
    },
    month_pnl: { received: receivedMonth, expenses: expensesMonth, payroll: payrollMonth, profit: C.round2(receivedMonth - expensesMonth - payrollMonth) },
    products: { active: prods.filter((p) => p.status === 'active').length, total: prods.length, effort: productEffort },
    clients: { total: clientsCount.count || 0 },
    todo: {
      pending_leaves: pendingLeaves.count || 0,
      overdue_tasks: openTasks.filter((x) => x.due_date && x.due_date < t).length,
      open_tasks: openTasks.length,
      quotes_awaiting: quotes.filter((x) => x.status === 'sent').length,
      quotes_accepted: quotes.filter((x) => x.status === 'accepted').length,
    },
  };
}

// ================================================================ REPORTS (P&L etc.)
export async function reports({ sb, q }) {
  const to = MONTH_RE.test(q.to || '') ? q.to : today().slice(0, 7);
  const from = MONTH_RE.test(q.from || '') ? q.from : C.addMonths(to + '-01', -11).slice(0, 7);
  if (from > to) throw bad('"From" month must be before "to" month.');
  const start = from + '-01', end = C.monthRange(to).last;

  const [invs, pays, exps, payroll, clients, products, emps, att] = await Promise.all([
    sb.from('erp_invoices').select('id, client_id, product_id, issue_date, total, amount_paid, status, taxable').gte('issue_date', start).lte('issue_date', end).then(must),
    sb.from('erp_payments').select('amount, paid_on, invoice_id').gte('paid_on', start).lte('paid_on', end).then(must),
    sb.from('erp_expenses').select('date, category, amount, gst_amount, product_id').gte('date', start).lte('date', end).then(must),
    sb.from('erp_payroll').select('employee_id, month, net_pay, earned, allowances, bonus, status, paid_days, working_days').gte('month', start).lte('month', end).then(must),
    sb.from('erp_clients').select('id, name, company').then(must),
    sb.from('erp_products').select('id, name, kind, status').then(must),
    sb.from('erp_employees').select('id, full_name, emp_code, status').then(must),
    sb.from('erp_attendance').select('employee_id, date, status').gte('date', start).lte('date', end).in('status', ['present', 'half-day']).then(must),
  ]);
  const allInvoices = must(await sb.from('erp_invoices').select('id, client_id, product_id'));
  const invById = new Map(allInvoices.map((i) => [i.id, i]));

  // month series
  const months = [];
  for (let m = from; m <= to; m = C.addMonths(m + '-01', 1).slice(0, 7)) months.push(m);
  const series = months.map((m) => {
    const inMonth = (d) => String(d).slice(0, 7) === m;
    const invoiced = C.round2(invs.filter((i) => inMonth(i.issue_date) && !['draft', 'cancelled'].includes(i.status)).reduce((t, i) => t + Number(i.total), 0));
    const received = C.round2(pays.filter((p) => inMonth(p.paid_on)).reduce((t, p) => t + Number(p.amount), 0));
    const expenses = C.round2(exps.filter((x) => inMonth(x.date)).reduce((t, x) => t + Number(x.amount) - Number(x.gst_amount), 0));
    const salaries = C.round2(payroll.filter((p) => inMonth(p.month)).reduce((t, p) => t + Number(p.net_pay), 0));
    return { month: m, invoiced, received, expenses, salaries, profit: C.round2(received - expenses - salaries) };
  });
  const sum = (k) => C.round2(series.reduce((t, r) => t + r[k], 0));

  const byCat = {};
  exps.forEach((x) => { byCat[x.category] = C.round2((byCat[x.category] || 0) + Number(x.amount) - Number(x.gst_amount)); });

  const clientRev = clients.map((c) => {
    const mine = invs.filter((i) => i.client_id === c.id && !['draft', 'cancelled'].includes(i.status));
    const rec = pays.filter((p) => invById.get(p.invoice_id)?.client_id === c.id).reduce((t, p) => t + Number(p.amount), 0);
    return { id: c.id, name: c.company || c.name, invoiced: C.round2(mine.reduce((t, i) => t + Number(i.total), 0)), received: C.round2(rec) };
  }).filter((c) => c.invoiced || c.received).sort((a, b) => b.received - a.received);

  const cost = await workCost(sb, { from: start, to: end });
  const productPnl = products.map((p) => {
    const w = cost.get(p.id) || { days: 0, cost: 0 };
    const rec = C.round2(pays.filter((x) => invById.get(x.invoice_id)?.product_id === p.id).reduce((t, x) => t + Number(x.amount), 0));
    const ex = C.round2(exps.filter((x) => x.product_id === p.id).reduce((t, x) => t + Number(x.amount) - Number(x.gst_amount), 0));
    return { id: p.id, name: p.name, kind: p.kind, days: w.days, salary_cost: w.cost, expenses: ex, received: rec, profit: C.round2(rec - w.cost - ex) };
  }).filter((p) => p.days || p.received || p.expenses).sort((a, b) => b.profit - a.profit);

  // utilisation: days on any product ÷ days worked
  const worked = new Map();
  att.forEach((a) => worked.set(a.employee_id, (worked.get(a.employee_id) || 0) + (a.status === 'present' ? 1 : 0.5)));
  const onProduct = new Map();
  cost.forEach((p) => p.byEmp.forEach((v, eid) => onProduct.set(eid, (onProduct.get(eid) || 0) + v.days)));
  const utilisation = emps.filter((e) => worked.has(e.id)).map((e) => {
    const w = worked.get(e.id), b = C.round2(onProduct.get(e.id) || 0);
    return { id: e.id, name: e.full_name, worked: w, on_products: b, pct: w ? Math.round((b / w) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);

  return {
    from, to, series,
    totals: { invoiced: sum('invoiced'), received: sum('received'), expenses: sum('expenses'), salaries: sum('salaries'), profit: sum('profit') },
    expenses_by_category: Object.entries(byCat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    clients: clientRev, products: productPnl, utilisation,
  };
}

// ================================================================ GST REPORT
export async function gst({ sb, q }) {
  const month = MONTH_RE.test(q.month || '') ? q.month : today().slice(0, 7);
  const { first, last } = C.monthRange(month);
  const [invs, exps, s] = await Promise.all([
    sb.from('erp_invoices').select('invoice_no, issue_date, taxable, cgst, sgst, igst, total, tax_type, gst_rate, status, erp_clients(name, company, gstin, state, state_code)')
      .gte('issue_date', first).lte('issue_date', last).order('issue_date').then(must),
    sb.from('erp_expenses').select('date, vendor, category, amount, gst_amount').gte('date', first).lte('date', last).gt('gst_amount', 0).order('date').then(must),
    getSettings(sb),
  ]);
  const rows = invs.filter((i) => !['draft', 'cancelled'].includes(i.status)).map((i) => ({
    invoice_no: i.invoice_no, date: i.issue_date, client: i.erp_clients?.company || i.erp_clients?.name, gstin: i.erp_clients?.gstin || '',
    type: i.erp_clients?.gstin ? 'B2B' : 'B2C', place: i.erp_clients?.state ? `${i.erp_clients.state} (${i.erp_clients.state_code})` : '',
    rate: Number(i.gst_rate), taxable: Number(i.taxable), cgst: Number(i.cgst), sgst: Number(i.sgst), igst: Number(i.igst), total: Number(i.total),
  }));
  const tot = (list, k) => C.round2(list.reduce((t, r) => t + Number(r[k]), 0));
  const part = (type) => { const l = rows.filter((r) => r.type === type); return { count: l.length, taxable: tot(l, 'taxable'), cgst: tot(l, 'cgst'), sgst: tot(l, 'sgst'), igst: tot(l, 'igst'), total: tot(l, 'total') }; };
  const outputTax = C.round2(tot(rows, 'cgst') + tot(rows, 'sgst') + tot(rows, 'igst'));
  const itc = tot(exps, 'gst_amount');
  return {
    month, company_gstin: s.gstin, rows, b2b: part('B2B'), b2c: part('B2C'),
    totals: { taxable: tot(rows, 'taxable'), cgst: tot(rows, 'cgst'), sgst: tot(rows, 'sgst'), igst: tot(rows, 'igst'), output_tax: outputTax },
    itc: { rows: exps, total: itc }, net_payable: C.round2(outputTax - itc),
  };
}

// ================================================================ STAFF USERS (roles)
export async function users({ sb, method, q, body }) {
  if (method === 'GET') return { users: must(await sb.from('erp_users').select('*').order('full_name')) };
  if (method === 'POST' || method === 'PUT') {
    const row = clean(body, { email: 'text!', full_name: 'text!', role: 'enum:admin|hr|accountant', active: 'bool' }, { partial: method === 'PUT' });
    if (row.email) {
      row.email = row.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw bad('Enter a valid email.');
    }
    if (method === 'POST') {
      row.role = row.role || 'hr';
      if (row.active === undefined) row.active = true;
      must(await sb.from('erp_users').insert(row));
      return { message: `${row.full_name} can now sign in at /erp/login with ${row.email}.` };
    }
    must(await sb.from('erp_users').update(row).eq('id', idOf(q)));
    return { message: 'User updated.' };
  }
  if (method === 'DELETE') {
    must(await sb.from('erp_users').delete().eq('id', idOf(q)));
    return { message: 'User removed.' };
  }
  throw methodNotAllowed();
}

// ================================================================ AUDIT
export async function audit({ sb, q }) {
  let query = sb.from('erp_audit').select('*').order('created_at', { ascending: false });
  if (q.resource) query = query.eq('resource', q.resource);
  if (q.actor) query = query.ilike('actor', `%${q.actor}%`);
  return { entries: must(await query.limit(Math.min(1000, parseInt(q.limit, 10) || 300))) };
}

export async function writeAudit(sb, entry) {
  try { await sb.from('erp_audit').insert(entry); } catch (e) { console.error('[audit]', e.message); }
}

// ================================================================ BACKUP
const BACKUP_TABLES = ['erp_settings', 'erp_employees', 'erp_salary_history', 'erp_clients', 'erp_products', 'erp_product_members',
  'erp_attendance', 'erp_timesheets', 'erp_leaves', 'erp_advances', 'erp_advance_recoveries', 'erp_payroll', 'erp_invoices',
  'erp_invoice_items', 'erp_payments', 'erp_quotes', 'erp_quote_items', 'erp_recurring', 'erp_expenses', 'erp_tasks', 'erp_users', 'erp_audit'];

export async function backup({ sb }) {
  const out = { exported_at: new Date().toISOString(), tables: {} };
  for (const t of BACKUP_TABLES) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const chunk = must(await sb.from(t).select('*').range(from, from + 999));
      rows.push(...chunk);
      if (chunk.length < 1000) break;
    }
    out.tables[t] = rows;
  }
  return { backup: out };
}

export { conflict };
