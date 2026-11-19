import { api, esc, money, fdate, fmonth, pageHead, empty, formModal, toast, toastErr, downloadCsv, canEdit } from '../core.js';
import { ymd, parseYmd } from '../calc.js';

const MODES = [['UPI', 'UPI'], ['Cash', 'Cash'], ['Bank transfer', 'Bank transfer'], ['Cheque', 'Cheque']];
const STATUS = { paid: ['badge-green', 'Paid'], partial: ['badge-amber', 'Part paid'], unpaid: ['badge-red', 'Not paid'], none: ['badge-grey', '—'] };
const status = (s) => `<span class="badge ${STATUS[s][0]}">${STATUS[s][1]}</span>`;
const refresh = () => dispatchEvent(new Event('erp:refresh'));
const shiftMonth = (month, n) => { const x = parseYmd(month + '-01'); x.setMonth(x.getMonth() + n); return ymd(x).slice(0, 7); };

/** Record money given to an employee for a salary month. */
export function giveSalary({ employee, month, balance, onSaved }) {
  formModal({
    title: `Give salary · ${employee.full_name}`, submitLabel: 'Save payment', wide: false,
    values: { month, amount: balance > 0 ? balance : '', paid_on: ymd(new Date()), mode: 'UPI' },
    fields: [
      { name: 'month', label: 'Salary for month', type: 'month', required: true },
      { name: 'amount', label: 'Amount given (₹)', type: 'number', step: '1', required: true, hint: balance > 0 ? `Balance for ${fmonth(month)}: ${money(balance)}. Give part now and the rest later if you like.` : '' },
      { name: 'paid_on', label: 'Given on', type: 'date', required: true },
      { name: 'mode', label: 'How', type: 'select', blank: false, options: MODES },
      { name: 'reference', label: 'UPI / bank reference', placeholder: 'Optional' },
      { name: 'note', label: 'Note', placeholder: 'e.g. Diwali bonus included' },
    ],
    onSubmit: async (v) => {
      if (Number(v.amount) <= 0) throw new Error('Enter an amount more than zero.');
      if (balance > 0 && v.month === month && Number(v.amount) > balance + 0.5 && !confirm(`${money(v.amount)} is more than the balance ${money(balance)}. Save anyway?`)) throw new Error('Not saved.');
      const r = await api.post('salary', { ...v, employee_id: employee.id });
      toast(r.message); onSaved && onSaved();
    },
  });
}

function paymentList(payments, can) {
  return payments.map((p) => `<li class="pay-line"><span><b>${money(p.amount)}</b> · ${esc(p.mode || '—')} · ${fdate(p.paid_on)}${p.reference ? ` <small class="muted">${esc(p.reference)}</small>` : ''}${p.note ? `<small class="block muted">${esc(p.note)}</small>` : ''}</span>
    ${can ? `<button class="icon-btn" data-del="${p.id}" title="Remove payment" aria-label="Remove payment"><i class="fas fa-trash"></i></button>` : ''}</li>`).join('');
}

function bindDeletes(root) {
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Remove this payment entry?')) return;
    try { const r = await api.del('salary', { id: b.dataset.del }); toast(r.message); refresh(); } catch (err) { toastErr(err); }
  }));
}

export async function salaryView(root, _p, query, alive) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : ymd(new Date()).slice(0, 7);
  const d = await api.get('salary', { month });
  if (!alive()) return;
  const can = canEdit('salary');
  const { rows, totals } = d;
  const pending = rows.filter((r) => r.balance > 0);
  const estimates = rows.some((r) => r.estimate && r.payable > 0);

  root.innerHTML = `
    ${pageHead('Salary', `${fmonth(month)} · how much each employee got and what is still to give`,
      `${rows.length ? '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export</button>' : ''}
       <a class="btn btn-ghost" href="#/payroll?month=${month}"><i class="fas fa-calculator"></i> Payroll</a>`)}
    <div class="toolbar">
      <div class="date-nav">
        <a class="icon-btn" href="#/salary?month=${shiftMonth(month, -1)}" aria-label="Previous month"><i class="fas fa-chevron-left"></i></a>
        <input type="month" id="month" value="${month}">
        <a class="icon-btn" href="#/salary?month=${shiftMonth(month, 1)}" aria-label="Next month"><i class="fas fa-chevron-right"></i></a>
      </div>
    </div>
    ${estimates ? `<div class="alert alert-info"><i class="fas fa-circle-info"></i><div>${d.payroll_generated ? 'Some employees have no payroll row' : 'Payroll is not generated'} for ${fmonth(month)}, so their <b>full monthly salary</b> is shown as payable. <a href="#/payroll?month=${month}">Generate payroll</a> to use attendance, absent deductions and advances.</div></div>` : ''}
    <div class="stats stats-4">
      <div class="stat"><span class="stat-label">To give (${fmonth(month)})</span><span class="stat-val">${money(totals.payable)}</span><span class="stat-sub">${rows.length} employee${rows.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="stat-label">Given</span><span class="stat-val t-green">${money(totals.paid)}</span></div>
      <div class="stat"><span class="stat-label">Balance to give</span><span class="stat-val ${totals.balance > 0 ? 't-red' : ''}">${money(totals.balance)}</span><span class="stat-sub">${pending.length} pending</span></div>
      <div class="stat"><span class="stat-label">Fully paid</span><span class="stat-val">${rows.filter((r) => r.status === 'paid').length}<small>/${rows.length}</small></span></div>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Employee</th><th class="r">Monthly salary</th><th class="r">To give</th><th class="r">Given</th><th class="r">Balance</th><th>Status</th><th>Payments</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="click" data-emp="${r.employee.id}">
        <td><div class="person"><span class="avatar sm">${esc(r.employee.full_name.charAt(0))}</span><div><b>${esc(r.employee.full_name)}</b><small>${esc(r.employee.emp_code || '')} · ${esc(r.employee.designation || '')}</small></div></div></td>
        <td class="r">${money(r.employee.monthly_salary)}</td>
        <td class="r">${money(r.payable)}${r.estimate && r.payable ? '<small class="block muted">full salary</small>' : r.payable !== Number(r.employee.monthly_salary) ? '<small class="block muted">from payroll</small>' : ''}</td>
        <td class="r t-green">${money(r.paid)}</td>
        <td class="r ${r.balance > 0 ? 't-red' : ''}"><b>${money(Math.max(0, r.balance))}</b>${r.balance < 0 ? `<small class="block muted">${money(-r.balance)} extra</small>` : ''}</td>
        <td>${status(r.status)}</td>
        <td>${r.payments.length ? `<ul class="pay-list">${paymentList(r.payments, can)}</ul>` : r.via_payroll ? '<small class="muted">Marked paid in Payroll</small>' : '<span class="muted">—</span>'}</td>
        <td class="r nowrap">${can && r.balance > 0 ? '<button class="btn btn-primary btn-xs" data-give>Give salary</button>' : can ? '<button class="btn btn-ghost btn-xs" data-give>+ Add</button>' : ''}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="r">${money(totals.payable)}</td><td class="r">${money(totals.paid)}</td><td class="r">${money(totals.balance)}</td><td colspan="3"></td></tr></tfoot>
    </table></div><p class="muted small mt">Click an employee to see every month of the year.</p>`
      : empty('fa-wallet', `No employees on the rolls in ${fmonth(month)}.`, '<a class="btn btn-primary" href="#/employees">Employees</a>')}`;

  root.querySelector('#month').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/salary?month=' + e.target.value; });
  root.querySelectorAll('tr[data-emp]').forEach((tr) => tr.addEventListener('click', (e) => {
    const r = rows.find((x) => String(x.employee.id) === tr.dataset.emp);
    if (e.target.closest('[data-give]')) { giveSalary({ employee: r.employee, month, balance: r.balance, onSaved: refresh }); return; }
    if (e.target.closest('[data-del]')) return;
    location.hash = `#/salary/${r.employee.id}`;
  }));
  bindDeletes(root);
  root.querySelector('#csv')?.addEventListener('click', () => downloadCsv(`uxonic-salary-${month}.csv`, [
    ['Code', 'Employee', 'Monthly salary', 'To give', 'Given', 'Balance', 'Status', 'Payments', 'Bank account', 'IFSC'],
    ...rows.map((r) => [r.employee.emp_code, r.employee.full_name, r.employee.monthly_salary, r.payable, r.paid, Math.max(0, r.balance), STATUS[r.status][1],
      r.payments.map((p) => `${p.amount} ${p.mode || ''} ${p.paid_on}`).join(' | '), r.employee.bank_account, r.employee.bank_ifsc]),
  ]));
}

export async function salaryEmployee(root, [id], query, alive) {
  const d = await api.get('salary', { employee_id: id, ...(query.fy ? { fy: query.fy } : {}) });
  if (!alive()) return;
  const can = canEdit('salary');
  const e = d.employee;
  const fyLabel = `${d.fy}-${String((d.fy + 1) % 100).padStart(2, '0')}`;
  const allPays = d.lines.flatMap((l) => l.payments);

  root.innerHTML = `
    ${pageHead(e.full_name, `Salary · FY ${fyLabel} · monthly salary ${money(e.monthly_salary)}`,
      `<a class="btn btn-ghost" href="#/salary"><i class="fas fa-arrow-left"></i> Back</a>
       <a class="btn btn-ghost" href="#/employees/${e.id}"><i class="fas fa-user"></i> Profile</a>
       ${can ? '<button class="btn btn-primary" id="give"><i class="fas fa-plus"></i> Give salary</button>' : ''}`)}
    <div class="toolbar">
      <div class="date-nav">
        <a class="icon-btn" href="#/salary/${e.id}?fy=${d.fy - 1}" aria-label="Previous year"><i class="fas fa-chevron-left"></i></a>
        <b>FY ${fyLabel}</b>
        <a class="icon-btn" href="#/salary/${e.id}?fy=${d.fy + 1}" aria-label="Next year"><i class="fas fa-chevron-right"></i></a>
      </div>
    </div>
    <div class="stats stats-4">
      <div class="stat"><span class="stat-label">To give this FY</span><span class="stat-val">${money(d.totals.payable)}</span><span class="stat-sub">${d.lines.length} month${d.lines.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="stat-label">Given</span><span class="stat-val t-green">${money(d.totals.paid)}</span><span class="stat-sub">${allPays.length} payment${allPays.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><span class="stat-label">Balance</span><span class="stat-val ${d.totals.balance > 0 ? 't-red' : ''}">${money(d.totals.balance)}</span></div>
      <div class="stat"><span class="stat-label">Bank</span><span class="stat-val sm">${esc(e.bank_account || '—')}</span><span class="stat-sub">${esc(e.bank_ifsc || '')}</span></div>
    </div>
    ${d.lines.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Month</th><th class="r">To give</th><th class="r">Given</th><th class="r">Balance</th><th>Status</th><th>Payments</th><th></th></tr></thead>
      <tbody>${d.lines.map((l) => `<tr data-month="${l.month}">
        <td><b>${fmonth(l.month)}</b>${l.payroll_id ? `<small class="block"><a class="link" href="#/payslip/${l.payroll_id}">Payslip</a></small>` : '<small class="block muted">No payroll — full salary</small>'}</td>
        <td class="r">${money(l.payable)}</td>
        <td class="r t-green">${money(l.paid)}</td>
        <td class="r ${l.balance > 0 ? 't-red' : ''}"><b>${money(Math.max(0, l.balance))}</b>${l.balance < 0 ? `<small class="block muted">${money(-l.balance)} extra</small>` : ''}</td>
        <td>${status(l.status)}</td>
        <td>${l.payments.length ? `<ul class="pay-list">${paymentList(l.payments, can)}</ul>` : l.via_payroll ? '<small class="muted">Marked paid in Payroll</small>' : '<span class="muted">—</span>'}</td>
        <td class="r">${can && l.balance > 0 ? '<button class="btn btn-primary btn-xs" data-give>Give</button>' : ''}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="r">${money(d.totals.payable)}</td><td class="r">${money(d.totals.paid)}</td><td class="r">${money(d.totals.balance)}</td><td colspan="3"></td></tr></tfoot>
    </table></div>` : empty('fa-wallet', `Nothing for FY ${fyLabel}.`)}`;

  const firstDue = d.lines.slice().reverse().find((l) => l.balance > 0);
  root.querySelector('#give')?.addEventListener('click', () => giveSalary({ employee: e, month: firstDue?.month || ymd(new Date()).slice(0, 7), balance: firstDue?.balance || 0, onSaved: refresh }));
  root.querySelectorAll('[data-give]').forEach((b) => b.addEventListener('click', () => {
    const l = d.lines.find((x) => x.month === b.closest('tr').dataset.month);
    giveSalary({ employee: e, month: l.month, balance: l.balance, onSaved: refresh });
  }));
  bindDeletes(root);
}
