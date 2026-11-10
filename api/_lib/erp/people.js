// Employees, salary history, attendance, timesheets, leave, advances, payroll
import {
  C, must, clean, bad, conflict, idOf, today, employedOn, getSettings, groupBy, workCost,
  DATE_RE, MONTH_RE, methodNotAllowed,
} from './core.js';

// ================================================================ EMPLOYEES
const EMP_SPEC = {
  emp_code: 'text', full_name: 'text!', email: 'text', phone: 'text', designation: 'text', department: 'text',
  employment_type: 'enum:full-time|part-time|intern|contract', join_date: 'date', exit_date: 'date',
  monthly_salary: 'num', bank_name: 'text', bank_account: 'text', bank_ifsc: 'text', pan: 'text',
  address: 'text', status: 'enum:active|inactive', notes: 'text',
  pf_applicable: 'bool', esi_applicable: 'bool', tds_percent: 'num', portal_enabled: 'bool',
};

export async function employees({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) return employeeDetail(sb, idOf(q));
    return { employees: must(await sb.from('erp_employees').select('*').order('status').order('full_name')) };
  }
  if (method === 'POST') {
    const row = clean(body, EMP_SPEC);
    if (row.monthly_salary == null) row.monthly_salary = 0;
    if (row.email) row.email = row.email.toLowerCase();
    if (!row.emp_code) {
      const last = must(await sb.from('erp_employees').select('id').order('id', { ascending: false }).limit(1));
      row.emp_code = 'UXN' + String((last[0]?.id || 0) + 1).padStart(3, '0');
    }
    const emp = must(await sb.from('erp_employees').insert(row).select('*').single());
    await sb.from('erp_salary_history').insert({ employee_id: emp.id, effective_from: emp.join_date || today(), monthly_salary: emp.monthly_salary, note: 'Starting salary' });
    return { employee: emp, message: 'Employee added.' };
  }
  if (method === 'PUT') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_employees').select('*').eq('id', id).single());
    const row = clean(body, EMP_SPEC, { partial: true });
    if ('emp_code' in row && !row.emp_code) delete row.emp_code;
    if (row.email) row.email = row.email.toLowerCase();
    const emp = must(await sb.from('erp_employees').update(row).eq('id', id).select('*').single());
    if ('monthly_salary' in row && Number(row.monthly_salary) !== Number(cur.monthly_salary)) {
      const eff = DATE_RE.test(String(body.salary_effective_from || '')) ? body.salary_effective_from : today();
      const hist = must(await sb.from('erp_salary_history').select('id').eq('employee_id', id).limit(1));
      if (!hist.length) {
        // keep the old salary for earlier months
        await sb.from('erp_salary_history').insert({ employee_id: id, effective_from: cur.join_date || '2000-01-01', monthly_salary: cur.monthly_salary, note: 'Previous salary' });
      }
      must(await sb.from('erp_salary_history').upsert({
        employee_id: id, effective_from: eff, monthly_salary: row.monthly_salary,
        note: body.salary_note || (Number(row.monthly_salary) > Number(cur.monthly_salary) ? 'Increment' : 'Revision'),
      }, { onConflict: 'employee_id,effective_from' }));
    }
    return { employee: emp, message: 'Employee updated.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const [{ count: att }, { count: pay }] = await Promise.all([
      sb.from('erp_attendance').select('id', { count: 'exact', head: true }).eq('employee_id', id),
      sb.from('erp_payroll').select('id', { count: 'exact', head: true }).eq('employee_id', id),
    ]);
    if ((att || 0) + (pay || 0) > 0) {
      must(await sb.from('erp_employees').update({ status: 'inactive', exit_date: today() }).eq('id', id));
      return { message: 'Employee has attendance/payroll history, so they were marked inactive instead of deleted.' };
    }
    must(await sb.from('erp_employees').delete().eq('id', id));
    return { message: 'Employee deleted.' };
  }
  throw methodNotAllowed();
}

async function employeeDetail(sb, id) {
  const { first, last } = C.monthRange(today().slice(0, 7));
  const [emp, members, pay, monthAtt, hist, advances, leaves, products, s] = await Promise.all([
    sb.from('erp_employees').select('*').eq('id', id).single().then(must),
    sb.from('erp_product_members').select('role, product_id').eq('employee_id', id).then(must),
    sb.from('erp_payroll').select('*').eq('employee_id', id).order('month', { ascending: false }).then(must),
    sb.from('erp_attendance').select('date, status').eq('employee_id', id).gte('date', first).lte('date', last).then(must),
    sb.from('erp_salary_history').select('*').eq('employee_id', id).order('effective_from', { ascending: false }).then(must),
    sb.from('erp_advances').select('*').eq('employee_id', id).order('given_on', { ascending: false }).then(must),
    sb.from('erp_leaves').select('*').eq('employee_id', id).order('from_date', { ascending: false }).limit(20).then(must),
    sb.from('erp_products').select('id, name').then(must),
    getSettings(sb),
  ]);
  const pname = new Map(products.map((p) => [p.id, p.name]));
  const cost = await workCost(sb, { employeeId: id });
  const work = new Map();
  members.forEach((m) => work.set(m.product_id, { product_id: m.product_id, name: pname.get(m.product_id), role: m.role, days: 0, cost: 0 }));
  cost.forEach((p, pid) => {
    const be = p.byEmp.get(id);
    if (!be) return;
    const w = work.get(pid) || { product_id: pid, name: pname.get(pid), role: null, days: 0, cost: 0 };
    w.days = be.days; w.cost = be.cost; work.set(pid, w);
  });
  return {
    employee: emp, salary_history: hist, products: members,
    work: [...work.values()].sort((a, b) => b.days - a.days),
    payroll: pay, advances: advances.map((a) => ({ ...a, balance: C.round2(a.amount - a.recovered) })),
    leaves, leave_balance: await leaveBalance(sb, emp, s),
    paid_total: C.round2(pay.filter((p) => p.status === 'paid').reduce((t, p) => t + Number(p.net_pay), 0)),
    month_summary: {
      worked: monthAtt.reduce((t, a) => t + (a.status === 'present' ? 1 : a.status === 'half-day' ? 0.5 : 0), 0),
      absent: monthAtt.filter((a) => a.status === 'absent').length,
      leave: monthAtt.filter((a) => a.status === 'leave').length,
    },
  };
}

// ================================================================ ATTENDANCE
async function paidLocked(sb, date, ids) {
  const monthFirst = String(date).slice(0, 7) + '-01';
  const paid = must(await sb.from('erp_payroll').select('employee_id').eq('month', monthFirst).eq('status', 'paid').in('employee_id', ids));
  return new Set(paid.map((p) => p.employee_id));
}

export async function attendance({ sb, method, q, body }) {
  if (method === 'GET') {
    let from, to;
    if (q.date) {
      if (!DATE_RE.test(q.date)) throw bad('date must be YYYY-MM-DD.');
      from = to = q.date;
    } else if (q.month) {
      if (!MONTH_RE.test(q.month)) throw bad('month must be YYYY-MM.');
      const r = C.monthRange(q.month); from = r.first; to = r.last;
    } else throw bad('date or month required.');

    const [emps, records] = await Promise.all([
      sb.from('erp_employees').select('id, emp_code, full_name, designation, status, join_date, exit_date').order('full_name').then(must),
      sb.from('erp_attendance').select('*').gte('date', from).lte('date', to).then(must),
    ]);
    const withRecord = new Set(records.map((r) => r.employee_id));
    const list = emps.filter((e) => withRecord.has(e.id) || (e.status === 'active' && employedOn(e, from, to)));
    const last_product = {};
    if (q.date) {
      const recent = must(await sb.from('erp_attendance').select('employee_id, product_id')
        .lt('date', q.date).not('product_id', 'is', null).order('date', { ascending: false }).limit(1000));
      recent.forEach((r) => { if (!(r.employee_id in last_product)) last_product[r.employee_id] = r.product_id; });
    }
    return { from, to, employees: list, records, last_product };
  }

  if (method === 'POST') {
    const date = body?.date;
    if (!DATE_RE.test(String(date))) throw bad('date must be YYYY-MM-DD.');
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!entries.length) throw bad('Nothing to save.');
    const ids = entries.map((e) => parseInt(e.employee_id, 10)).filter(Boolean);
    const locked = await paidLocked(sb, date, ids);
    const existing = must(await sb.from('erp_attendance').select('employee_id, check_in, check_out, source').eq('date', date).in('employee_id', ids));
    const exBy = new Map(existing.map((x) => [x.employee_id, x]));

    const upserts = [], clears = [], skipped = [];
    for (const e of entries) {
      const employee_id = parseInt(e.employee_id, 10);
      if (!employee_id) continue;
      if (locked.has(employee_id)) { skipped.push(employee_id); continue; }
      if (!e.status) { clears.push(employee_id); continue; }
      const row = clean({ ...e, date }, {
        status: 'enum:present|half-day|absent|leave|holiday', product_id: 'int', note: 'text', date: 'date!',
      });
      if (!['present', 'half-day'].includes(row.status)) row.product_id = null;
      const ex = exBy.get(employee_id);
      upserts.push({ employee_id, ...row, source: ex?.source === 'self' ? 'self' : 'admin', leave_id: null });
    }
    if (upserts.length) must(await sb.from('erp_attendance').upsert(upserts, { onConflict: 'employee_id,date' }));
    if (clears.length) must(await sb.from('erp_attendance').delete().eq('date', date).in('employee_id', clears));
    return {
      saved: upserts.length, cleared: clears.length, skipped,
      message: skipped.length
        ? `Saved. ${skipped.length} employee(s) skipped — their payroll for this month is already marked paid.`
        : 'Attendance saved.',
    };
  }
  throw methodNotAllowed();
}

// ================================================================ TIMESHEETS (hours per product per day)
export async function saveTimesheet(sb, employeeId, date, entries) {
  if (!DATE_RE.test(String(date))) throw bad('date must be YYYY-MM-DD.');
  const rows = (Array.isArray(entries) ? entries : [])
    .map((e) => clean(e, { product_id: 'int!', hours: 'num!', note: 'text', task_id: 'int' }))
    .filter((r) => r.hours > 0);
  const total = rows.reduce((s, r) => s + r.hours, 0);
  if (total > 24) throw bad('Total hours for a day cannot exceed 24.');
  must(await sb.from('erp_timesheets').delete().eq('employee_id', employeeId).eq('date', date));
  if (rows.length) must(await sb.from('erp_timesheets').insert(rows.map((r) => ({ ...r, employee_id: employeeId, date }))));
  return { message: rows.length ? `Logged ${C.round2(total)} hour(s).` : 'Timesheet cleared.', hours: C.round2(total) };
}

export async function timesheets({ sb, method, q, body }) {
  if (method === 'GET') {
    let query = sb.from('erp_timesheets').select('*, erp_products(name), erp_employees(full_name, emp_code)').order('date', { ascending: false });
    if (q.employee_id) query = query.eq('employee_id', parseInt(q.employee_id, 10));
    if (q.date) query = query.eq('date', q.date);
    if (q.from) query = query.gte('date', q.from);
    if (q.to) query = query.lte('date', q.to);
    if (q.product_id) query = query.eq('product_id', parseInt(q.product_id, 10));
    return { entries: must(await query.limit(2000)) };
  }
  if (method === 'POST') return saveTimesheet(sb, parseInt(body?.employee_id, 10) || (() => { throw bad('employee_id required.'); })(), body.date, body.entries);
  if (method === 'DELETE') { must(await sb.from('erp_timesheets').delete().eq('id', idOf(q))); return { message: 'Entry removed.' }; }
  throw methodNotAllowed();
}

// ================================================================ LEAVE
export async function leaveBalance(sb, emp, s, year = today().slice(0, 4)) {
  const rows = must(await sb.from('erp_leaves').select('leave_type, days, status, from_date')
    .eq('employee_id', emp.id).gte('from_date', `${year}-01-01`).lte('from_date', `${year}-12-31`));
  const used = (t) => C.round2(rows.filter((r) => r.leave_type === t && r.status === 'approved').reduce((a, r) => a + Number(r.days), 0));
  const pending = (t) => C.round2(rows.filter((r) => r.leave_type === t && r.status === 'pending').reduce((a, r) => a + Number(r.days), 0));
  return {
    year,
    casual: { quota: Number(s.leave_casual), used: used('casual'), pending: pending('casual'), left: C.round2(Number(s.leave_casual) - used('casual')) },
    sick: { quota: Number(s.leave_sick), used: used('sick'), pending: pending('sick'), left: C.round2(Number(s.leave_sick) - used('sick')) },
    unpaid: { used: used('unpaid'), pending: pending('unpaid') },
  };
}

/** Create a leave request (used by HR and by the employee portal) */
export async function createLeave(sb, employeeId, body, { autoApprove = false, actor = 'admin' } = {}) {
  const row = clean(body, { leave_type: 'enum:casual|sick|unpaid', from_date: 'date!', to_date: 'date!', reason: 'text' });
  row.leave_type = row.leave_type || 'casual';
  if (row.to_date < row.from_date) throw bad('End date is before start date.');
  const s = await getSettings(sb);
  const emp = must(await sb.from('erp_employees').select('*').eq('id', employeeId).single());
  const days = C.workingDatesBetween(row.from_date, row.to_date, s.weekly_off).length;
  if (!days) throw bad('Those dates are all weekly offs — no leave needed.');
  const overlap = must(await sb.from('erp_leaves').select('id').eq('employee_id', employeeId).in('status', ['pending', 'approved'])
    .lte('from_date', row.to_date).gte('to_date', row.from_date));
  if (overlap.length) throw conflict('There is already a leave request covering these dates.');
  if (row.leave_type !== 'unpaid') {
    const bal = await leaveBalance(sb, emp, s, row.from_date.slice(0, 4));
    const left = bal[row.leave_type].left - bal[row.leave_type].pending;
    if (days > left) throw bad(`Not enough ${row.leave_type} leave: ${left} day(s) left, ${days} requested. Use unpaid leave for the rest.`);
  }
  const leave = must(await sb.from('erp_leaves').insert({ ...row, employee_id: employeeId, days }).select('*').single());
  if (autoApprove) await decideLeave(sb, leave.id, 'approved', actor);
  return { leave, message: autoApprove ? `Leave added and approved (${days} day(s)).` : `Leave requested for ${days} working day(s).` };
}

async function decideLeave(sb, id, status, actor) {
  const lv = must(await sb.from('erp_leaves').select('*').eq('id', id).single());
  if (status === 'approved') {
    if (lv.status !== 'pending') throw conflict(`Only pending requests can be approved (this one is ${lv.status}).`);
    const s = await getSettings(sb);
    const dates = C.workingDatesBetween(lv.from_date, lv.to_date, s.weekly_off);
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
    for (const m of months) {
      if ((await paidLocked(sb, m + '-01', [lv.employee_id])).size) throw conflict(`Payroll for ${m} is already paid for this employee. Undo it first.`);
    }
    must(await sb.from('erp_attendance').upsert(dates.map((date) => ({
      employee_id: lv.employee_id, date, status: lv.leave_type === 'unpaid' ? 'absent' : 'leave',
      product_id: null, note: `${lv.leave_type} leave${lv.reason ? ': ' + lv.reason.slice(0, 80) : ''}`, source: 'leave', leave_id: lv.id,
    })), { onConflict: 'employee_id,date' }));
  } else if (status === 'rejected') {
    if (lv.status !== 'pending') throw conflict('Only pending requests can be rejected.');
  } else if (status === 'cancelled') {
    if (!['pending', 'approved'].includes(lv.status)) throw conflict(`This request is already ${lv.status}.`);
    if (lv.status === 'approved') must(await sb.from('erp_attendance').delete().eq('leave_id', lv.id));
  }
  must(await sb.from('erp_leaves').update({ status, decided_by: actor, decided_at: new Date().toISOString() }).eq('id', id));
  return lv;
}
export { decideLeave };

export async function leaves({ sb, method, q, body, actor }) {
  if (method === 'GET') {
    let query = sb.from('erp_leaves').select('*, erp_employees(full_name, emp_code, designation)').order('from_date', { ascending: false });
    if (q.status) query = query.eq('status', q.status);
    if (q.employee_id) query = query.eq('employee_id', parseInt(q.employee_id, 10));
    const list = must(await query.limit(500));
    const s = await getSettings(sb);
    const emps = must(await sb.from('erp_employees').select('*').eq('status', 'active').order('full_name'));
    const year = /^\d{4}$/.test(String(q.year || '')) ? String(q.year) : today().slice(0, 4);
    const balances = [];
    for (const e of emps) balances.push({ employee_id: e.id, full_name: e.full_name, ...(await leaveBalance(sb, e, s, year)) });
    return { leaves: list, balances, year, quotas: { casual: s.leave_casual, sick: s.leave_sick } };
  }
  if (method === 'POST') {
    const employeeId = parseInt(body?.employee_id, 10);
    if (!employeeId) throw bad('employee_id required.');
    return createLeave(sb, employeeId, body, { autoApprove: body.approve !== false, actor: actor.email });
  }
  if (method === 'PUT') {
    const status = clean(body, { status: 'enum:approved|rejected|cancelled' }).status;
    if (!status) throw bad('status required.');
    await decideLeave(sb, idOf(q), status, actor.email);
    return { message: `Leave ${status}.` };
  }
  throw methodNotAllowed();
}

// ================================================================ ADVANCES / LOANS
export async function advances({ sb, method, q, body }) {
  if (method === 'GET') {
    const list = must(await sb.from('erp_advances').select('*, erp_employees(full_name, emp_code)').order('given_on', { ascending: false }));
    return { advances: list.map((a) => ({ ...a, balance: C.round2(a.amount - a.recovered) })) };
  }
  if (method === 'POST') {
    const row = clean(body, { employee_id: 'int!', amount: 'num!', monthly_deduction: 'num!', given_on: 'date', note: 'text' });
    if (row.amount <= 0 || row.monthly_deduction <= 0) throw bad('Amount and monthly deduction must be more than zero.');
    if (row.monthly_deduction > row.amount) row.monthly_deduction = row.amount;
    row.given_on = row.given_on || today();
    must(await sb.from('erp_advances').insert(row));
    return { message: 'Advance recorded. It will be deducted from upcoming payroll automatically.' };
  }
  if (method === 'PUT') {
    const row = clean(body, { monthly_deduction: 'num', note: 'text' }, { partial: true });
    must(await sb.from('erp_advances').update(row).eq('id', idOf(q)));
    return { message: 'Advance updated.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const a = must(await sb.from('erp_advances').select('recovered').eq('id', id).single());
    if (Number(a.recovered) > 0) throw conflict('Part of this advance is already recovered through payroll, so it cannot be deleted.');
    must(await sb.from('erp_advances').delete().eq('id', id));
    return { message: 'Advance deleted.' };
  }
  throw methodNotAllowed();
}

// ================================================================ PAYROLL
async function generatePayroll(sb, month, onlyIds = null) {
  const { first, last } = C.monthRange(month);
  const s = await getSettings(sb);
  const [emps, existing, att, hist, advs] = await Promise.all([
    sb.from('erp_employees').select('*').then(must),
    sb.from('erp_payroll').select('*').eq('month', first).then(must),
    sb.from('erp_attendance').select('employee_id, date, status').gte('date', first).lte('date', last).then(must),
    sb.from('erp_salary_history').select('*').then(must),
    sb.from('erp_advances').select('*').lte('given_on', last).then(must),
  ]);
  const existingBy = new Map(existing.map((r) => [r.employee_id, r]));
  const attBy = groupBy(att, 'employee_id');
  const histBy = groupBy(hist, 'employee_id');
  const advBy = groupBy(advs.filter((a) => Number(a.amount) - Number(a.recovered) > 0.004), 'employee_id');

  const targets = emps.filter((e) => (!onlyIds || onlyIds.includes(e.id)) &&
    (existingBy.has(e.id) || (e.status === 'active' && employedOn(e, first, last))));
  const rows = [];
  let skippedPaid = 0;
  for (const e of targets) {
    const prev = existingBy.get(e.id);
    if (prev?.status === 'paid') { skippedPaid++; continue; }
    const open = advBy.get(e.id) || [];
    const advanceDue = Math.min(
      open.reduce((t, a) => t + Number(a.monthly_deduction), 0),
      open.reduce((t, a) => t + Number(a.amount) - Number(a.recovered), 0),
    );
    const calc = C.computePayroll({
      month, salary: C.salaryForMonth(histBy.get(e.id) || [], month, e.monthly_salary),
      joinDate: e.join_date, exitDate: e.exit_date, attendance: attBy.get(e.id) || [], weeklyOff: s.weekly_off,
      allowances: prev?.allowances || 0, bonus: prev?.bonus || 0, deductions: prev?.deductions || 0,
      statutory: { pf: s.pf_enabled && e.pf_applicable !== false, esi: s.esi_enabled && e.esi_applicable !== false, tdsPercent: e.tds_percent || 0 },
      advanceDue,
    });
    rows.push({ employee_id: e.id, month: first, ...calc, status: 'draft' });
  }
  if (rows.length) must(await sb.from('erp_payroll').upsert(rows, { onConflict: 'employee_id,month' }));
  return { rows, skippedPaid };
}

/** On "paid": take the advance deduction out of the oldest open advances */
async function recoverAdvances(sb, payroll) {
  let left = Number(payroll.advance_deduction) || 0;
  if (left <= 0) return;
  const open = must(await sb.from('erp_advances').select('*').eq('employee_id', payroll.employee_id).order('given_on'));
  for (const a of open) {
    const bal = C.round2(Number(a.amount) - Number(a.recovered));
    if (bal <= 0 || left <= 0) continue;
    const take = C.round2(Math.min(bal, left));
    must(await sb.from('erp_advance_recoveries').insert({ advance_id: a.id, payroll_id: payroll.id, amount: take }));
    must(await sb.from('erp_advances').update({ recovered: C.round2(Number(a.recovered) + take) }).eq('id', a.id));
    left = C.round2(left - take);
  }
}
async function undoAdvances(sb, payrollId) {
  const recs = must(await sb.from('erp_advance_recoveries').select('*').eq('payroll_id', payrollId));
  for (const r of recs) {
    const a = must(await sb.from('erp_advances').select('recovered').eq('id', r.advance_id).single());
    must(await sb.from('erp_advances').update({ recovered: C.round2(Math.max(0, Number(a.recovered) - Number(r.amount))) }).eq('id', r.advance_id));
  }
  must(await sb.from('erp_advance_recoveries').delete().eq('payroll_id', payrollId));
}

export async function payroll({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const row = must(await sb.from('erp_payroll').select('*, erp_employees(*)').eq('id', idOf(q)).single());
      return { payslip: row, settings: await getSettings(sb) };
    }
    if (!MONTH_RE.test(String(q.month))) throw bad('month must be YYYY-MM.');
    const rows = must(await sb.from('erp_payroll')
      .select('*, erp_employees(emp_code, full_name, designation, department, bank_account, bank_ifsc)')
      .eq('month', q.month + '-01').order('id'));
    return { month: q.month, rows };
  }
  if (method === 'POST') {
    const month = String(body?.month || '');
    if (!MONTH_RE.test(month)) throw bad('month must be YYYY-MM.');
    const { rows, skippedPaid } = await generatePayroll(sb, month);
    const unmarked = rows.reduce((n, r) => n + r.unmarked_days, 0);
    return {
      generated: rows.length, skipped_paid: skippedPaid,
      message: `Payroll calculated for ${rows.length} employee(s)` +
        (skippedPaid ? `, ${skippedPaid} already paid (left unchanged)` : '') +
        (unmarked ? `. Warning: ${unmarked} working day(s) have no attendance and were not paid.` : '.'),
    };
  }
  if (method === 'PUT') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_payroll').select('*').eq('id', id).single());
    const upd = clean(body, {
      allowances: 'num', bonus: 'num', deductions: 'num', notes: 'text',
      status: 'enum:draft|paid', paid_on: 'date', payment_mode: 'text',
    }, { partial: true });
    const amountsChanged = ['allowances', 'bonus', 'deductions'].some((k) => k in upd && Number(upd[k]) !== Number(cur[k]));
    if (cur.status === 'paid' && amountsChanged) throw conflict('This payslip is already paid. Mark it unpaid first to change amounts.');

    if (upd.status === 'paid' && cur.status !== 'paid') {
      must(await sb.from('erp_payroll').update({ status: 'paid', paid_on: upd.paid_on || today(), payment_mode: upd.payment_mode || null }).eq('id', id));
      await recoverAdvances(sb, cur);
      return { message: 'Marked paid.' };
    }
    if (upd.status === 'draft' && cur.status === 'paid') {
      await undoAdvances(sb, id);
      must(await sb.from('erp_payroll').update({ status: 'draft', paid_on: null }).eq('id', id));
      await generatePayroll(sb, String(cur.month).slice(0, 7), [cur.employee_id]);
      return { message: 'Moved back to draft.' };
    }
    const amounts = {};
    ['allowances', 'bonus', 'deductions', 'notes'].forEach((k) => { if (k in upd) amounts[k] = upd[k] ?? (k === 'notes' ? null : 0); });
    if (Object.keys(amounts).length) must(await sb.from('erp_payroll').update(amounts).eq('id', id));
    // recompute ESI/TDS/advance/net with the new amounts
    await generatePayroll(sb, String(cur.month).slice(0, 7), [cur.employee_id]);
    return { message: 'Payroll updated.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_payroll').select('status').eq('id', id).single());
    if (cur.status === 'paid') throw conflict('Paid payroll cannot be deleted.');
    must(await sb.from('erp_payroll').delete().eq('id', id));
    return { message: 'Payroll row removed.' };
  }
  throw methodNotAllowed();
}
