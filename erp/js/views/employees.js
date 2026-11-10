import { api, esc, money, fdate, fmonth, num, badge, pageHead, empty, formModal, toast, toastErr, downloadCsv, canEdit } from '../core.js';
import { ymd } from '../calc.js';

export const EMP_FIELDS = [
  { type: 'section', label: 'Basic details' },
  { name: 'full_name', label: 'Full name', required: true },
  { name: 'emp_code', label: 'Employee code', placeholder: 'Auto (UXN001…)' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'designation', label: 'Designation', placeholder: 'e.g. Frontend Developer' },
  { name: 'department', label: 'Department', placeholder: 'e.g. Development' },
  { name: 'employment_type', label: 'Employment type', type: 'select', blank: false, default: 'full-time',
    options: [['full-time', 'Full-time'], ['part-time', 'Part-time'], ['intern', 'Intern'], ['contract', 'Contract']] },
  { name: 'status', label: 'Status', type: 'select', blank: false, default: 'active', options: [['active', 'Active'], ['inactive', 'Inactive']] },
  { name: 'join_date', label: 'Joining date', type: 'date' },
  { name: 'exit_date', label: 'Exit date', type: 'date', hint: 'Leave empty while working here' },
  { type: 'section', label: 'Salary & bank' },
  { name: 'monthly_salary', label: 'Monthly salary (₹)', type: 'number', step: '0.01', required: true, hint: 'Paid in full for a month with full attendance' },
  { name: 'pan', label: 'PAN' },
  { name: 'bank_name', label: 'Bank name' },
  { name: 'bank_account', label: 'Account number' },
  { name: 'bank_ifsc', label: 'IFSC' },
  { type: 'section', label: 'Statutory deductions & portal' },
  { name: 'pf_applicable', label: 'PF', type: 'select', blank: false, default: 'true', options: [['true', 'Deduct PF (if enabled in settings)'], ['false', 'Not applicable']] },
  { name: 'esi_applicable', label: 'ESI', type: 'select', blank: false, default: 'true', options: [['true', 'Deduct ESI (if enabled & eligible)'], ['false', 'Not applicable']] },
  { name: 'tds_percent', label: 'TDS % on pay', type: 'number', step: '0.01', hint: 'e.g. 10 for contractors (194J); 0 for most employees' },
  { name: 'portal_enabled', label: 'Employee portal', type: 'select', blank: false, default: 'true', options: [['true', 'Allowed — sign in at /erp/me with their email'], ['false', 'No access']] },
  { name: 'address', label: 'Address', type: 'textarea', span: 2, rows: 2 },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
];

export function editEmployee(emp, onDone) {
  const fields = emp
    ? EMP_FIELDS.flatMap((f) => (f.name === 'monthly_salary'
      ? [f, { name: 'salary_effective_from', label: 'New salary applies from', type: 'date', default: ymd(new Date()), hint: 'Only used if you change the salary — earlier months keep the old rate' }]
      : [f]))
    : EMP_FIELDS;
  const values = emp ? { ...emp, pf_applicable: String(emp.pf_applicable !== false), esi_applicable: String(emp.esi_applicable !== false), portal_enabled: String(emp.portal_enabled !== false) } : {};
  formModal({
    title: emp ? `Edit ${emp.full_name}` : 'Add employee',
    fields,
    values,
    submitLabel: emp ? 'Save changes' : 'Add employee',
    onSubmit: async (v) => {
      ['pf_applicable', 'esi_applicable', 'portal_enabled'].forEach((k) => { v[k] = v[k] !== 'false'; });
      if (v.tds_percent == null) v.tds_percent = 0;
      const r = emp ? await api.put('employees', emp.id, v) : await api.post('employees', v);
      toast(r.message);
      onDone && onDone(r.employee);
    },
  });
}

export async function employeesList(root, _p, query, alive) {
  const { employees } = await api.get('employees');
  if (!alive()) return;
  let filter = query.status || 'active';
  let search = '';

  const draw = () => {
    const s = search.toLowerCase();
    const rows = employees.filter((e) => (filter === 'all' || e.status === filter) &&
      (!s || [e.full_name, e.emp_code, e.designation, e.department, e.email, e.phone].some((x) => String(x || '').toLowerCase().includes(s))));
    const activeCount = employees.filter((e) => e.status === 'active').length;
    const payrollTotal = employees.filter((e) => e.status === 'active').reduce((t, e) => t + Number(e.monthly_salary), 0);

    root.innerHTML = `
      ${pageHead('Employees', `${activeCount} active · ${money(payrollTotal)} monthly salaries`,
        `<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export</button>
         <button class="btn btn-primary" id="add"><i class="fas fa-user-plus"></i> Add employee</button>`)}
      <div class="toolbar">
        <div class="seg-tabs">${['active', 'inactive', 'all'].map((f) => `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${f}</button>`).join('')}</div>
        <label class="search"><i class="fas fa-magnifying-glass"></i><input id="q" placeholder="Search name, code, role…" value="${esc(search)}"></label>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Employee</th><th>Designation</th><th>Type</th><th>Joined</th><th class="r">Monthly salary</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map((e) => `
          <tr class="click" data-id="${e.id}">
            <td><div class="person"><span class="avatar sm">${esc(e.full_name.charAt(0))}</span><div><b>${esc(e.full_name)}</b><small>${esc(e.emp_code)}${e.phone ? ' · ' + esc(e.phone) : ''}</small></div></div></td>
            <td>${esc(e.designation || '—')}<small class="block muted">${esc(e.department || '')}</small></td>
            <td class="cap">${esc(e.employment_type)}</td>
            <td>${fdate(e.join_date)}</td>
            <td class="r">${money(e.monthly_salary)}</td>
            <td>${badge(e.status)}</td>
            <td class="r"><button class="icon-btn" data-edit="${e.id}" title="Edit" aria-label="Edit ${esc(e.full_name)}"><i class="fas fa-pen"></i></button></td>
          </tr>`).join('')}</tbody></table></div>`
      : empty('fa-users', employees.length ? 'No employees match.' : 'No employees yet. Add your team to start tracking attendance and payroll.',
        employees.length ? '' : '<button class="btn btn-primary" id="add2"><i class="fas fa-user-plus"></i> Add first employee</button>')}`;

    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    const q = root.querySelector('#q');
    q.addEventListener('input', () => { search = q.value; const pos = q.selectionStart; draw(); const n = root.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    const add = () => editEmployee(null, (e) => { employees.push(e); draw(); });
    root.querySelector('#add').addEventListener('click', add);
    root.querySelector('#add2')?.addEventListener('click', add);
    root.querySelector('#csv').addEventListener('click', () => downloadCsv('uxonic-employees.csv', [
      ['Code', 'Name', 'Email', 'Phone', 'Designation', 'Department', 'Type', 'Join date', 'Exit date', 'Monthly salary', 'PAN', 'Bank', 'Account', 'IFSC', 'Status'],
      ...rows.map((e) => [e.emp_code, e.full_name, e.email, e.phone, e.designation, e.department, e.employment_type, e.join_date, e.exit_date, e.monthly_salary, e.pan, e.bank_name, e.bank_account, e.bank_ifsc, e.status]),
    ]));
    root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (ev) => {
      const editBtn = ev.target.closest('[data-edit]');
      const emp = employees.find((x) => String(x.id) === tr.dataset.id);
      if (editBtn) { editEmployee(emp, (u) => { Object.assign(emp, u); draw(); }); return; }
      location.hash = '#/employees/' + tr.dataset.id;
    }));
  };
  draw();
}

export async function employeeDetail(root, [id], _q, alive) {
  const d = await api.get('employees', { id });
  if (!alive()) return;
  const e = d.employee;
  const info = (label, v) => `<div class="kv"><span>${esc(label)}</span><b>${v || '—'}</b></div>`;

  root.innerHTML = `
    ${pageHead(e.full_name, `${esc(e.emp_code)} · ${esc(e.designation || 'No designation')} ${badge(e.status)}`,
      `<a class="btn btn-ghost" href="#/employees"><i class="fas fa-arrow-left"></i> Back</a>
       <button class="btn btn-ghost danger" id="del"><i class="fas fa-trash"></i> Remove</button>
       <button class="btn btn-primary" id="edit"><i class="fas fa-pen"></i> Edit</button>`)}

    <div class="stats stats-4">
      <div class="stat"><span class="stat-label">Monthly salary</span><span class="stat-val">${money(e.monthly_salary)}</span></div>
      <div class="stat"><span class="stat-label">Days worked · this month</span><span class="stat-val">${num(d.month_summary.worked)}</span><span class="stat-sub">${d.month_summary.absent} absent · ${d.month_summary.leave} leave</span></div>
      <div class="stat"><span class="stat-label">Total paid (all time)</span><span class="stat-val">${money(d.paid_total)}</span></div>
      <div class="stat"><span class="stat-label">Products</span><span class="stat-val">${d.products.length}</span></div>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Details</h2></div>
        <div class="kv-grid">
          ${info('Email', esc(e.email))}${info('Phone', esc(e.phone))}
          ${info('Department', esc(e.department))}${info('Employment type', esc(e.employment_type))}
          ${info('Joined', fdate(e.join_date))}${info('Exit', e.exit_date ? fdate(e.exit_date) : '')}
          ${info('PAN', esc(e.pan))}${info('Bank', esc(e.bank_name))}
          ${info('Account', esc(e.bank_account))}${info('IFSC', esc(e.bank_ifsc))}
        </div>
        ${e.address ? `<p class="muted mt">${esc(e.address)}</p>` : ''}
        ${e.notes ? `<p class="note mt">${esc(e.notes)}</p>` : ''}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Work by product</h2></div>
        ${d.work.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Product</th><th>Role</th><th class="r">Days</th><th class="r">Salary cost</th></tr></thead>
          <tbody>${d.work.map((w) => `<tr class="click" data-href="#/products/${w.product_id}"><td><b>${esc(w.name)}</b></td><td>${esc(w.role || '—')}</td><td class="r">${num(w.days)}</td><td class="r">${money(w.cost)}</td></tr>`).join('')}</tbody>
        </table></div>` : empty('fa-cubes', 'Not assigned to any product yet.')}
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>Payroll history</h2><a class="link" href="#/payroll">Payroll <i class="fas fa-arrow-right"></i></a></div>
      ${d.payroll.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Month</th><th class="r">Paid days</th><th class="r">Earned</th><th class="r">Net pay</th><th>Status</th><th>Paid on</th><th></th></tr></thead>
        <tbody>${d.payroll.map((p) => `<tr>
          <td><b>${fmonth(p.month)}</b></td><td class="r">${num(p.paid_days)} / ${num(p.working_days)}</td>
          <td class="r">${money(p.earned)}</td><td class="r"><b>${money(p.net_pay)}</b></td>
          <td>${badge(p.status)}</td><td>${fdate(p.paid_on)}</td>
          <td class="r"><a class="btn btn-ghost btn-xs" href="#/payslip/${p.id}">Payslip</a></td></tr>`).join('')}</tbody>
      </table></div>` : empty('fa-money-check-dollar', 'No payroll generated yet.')}
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Leave · ${esc(d.leave_balance.year)}</h2><a class="link" href="#/leaves">Leave <i class="fas fa-arrow-right"></i></a></div>
        <div class="kv-grid">
          <div class="kv"><span>Casual left</span><b>${num(d.leave_balance.casual.left)} / ${num(d.leave_balance.casual.quota)}</b></div>
          <div class="kv"><span>Sick left</span><b>${num(d.leave_balance.sick.left)} / ${num(d.leave_balance.sick.quota)}</b></div>
        </div>
        ${d.leaves.length ? `<ul class="list mt">${d.leaves.slice(0, 6).map((l) => `<li><span>${esc(l.leave_type)} · ${fdate(l.from_date)}${l.to_date !== l.from_date ? ' → ' + fdate(l.to_date) : ''} (${num(l.days)} d)</span> ${badge({ pending: 'sent', approved: 'active', rejected: 'absent', cancelled: 'draft' }[l.status], l.status)}</li>`).join('')}</ul>` : '<p class="muted mt">No leave taken.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Salary history</h2></div>
        ${d.salary_history.length ? `<ul class="list">${d.salary_history.map((h) => `<li><span>From ${fdate(h.effective_from)} <small class="muted">${esc(h.note || '')}</small></span><b>${money(h.monthly_salary)}</b></li>`).join('')}</ul>` : '<p class="muted">No changes recorded.</p>'}
        ${d.advances.length ? `<div class="panel-head mt"><h2>Advances</h2><a class="link" href="#/advances">All <i class="fas fa-arrow-right"></i></a></div>
          <ul class="list">${d.advances.map((a) => `<li><span>${fdate(a.given_on)} · ${money(a.amount)} (${money(a.monthly_deduction)}/month)</span><b class="${a.balance > 0 ? 't-red' : 't-green'}">${a.balance > 0 ? money(a.balance) + ' due' : 'cleared'}</b></li>`).join('')}</ul>` : ''}
      </section>
    </div>`;

  if (!canEdit('employees')) { root.querySelector('#edit')?.remove(); root.querySelector('#del')?.remove(); }
  root.querySelector('#edit')?.addEventListener('click', () => editEmployee(e, () => dispatchEvent(new Event('erp:refresh'))));
  root.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm(`Remove ${e.full_name}? If they have attendance or payroll history they will be marked inactive instead.`)) return;
    try { const r = await api.del('employees', { id: e.id }); toast(r.message); location.hash = '#/employees'; }
    catch (err) { toastErr(err); }
  });
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
}
