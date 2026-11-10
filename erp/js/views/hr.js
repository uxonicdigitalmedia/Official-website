import { api, esc, money, fdate, num, badge, pageHead, empty, formModal, toast, toastErr, canEdit } from '../core.js';
import { ymd, parseYmd } from '../calc.js';

const LT = { casual: 'Casual', sick: 'Sick', unpaid: 'Unpaid' };
const leaveBadge = (s) => badge({ pending: 'sent', approved: 'active', rejected: 'absent', cancelled: 'draft' }[s] || s, s);

// ================================================================ LEAVE
export async function leavesView(root, _p, query, alive) {
  const status = query.status ?? 'pending';
  const year = /^\d{4}$/.test(query.year || '') ? query.year : String(new Date().getFullYear());
  const [d, { employees }] = await Promise.all([api.get('leaves', { ...(status ? { status } : {}), year }), api.get('employees')]);
  if (!alive()) return;
  const can = canEdit('leaves');
  const refresh = () => { dispatchEvent(new Event('erp:refresh')); dispatchEvent(new Event('erp:badges')); };

  root.innerHTML = `
    ${pageHead('Leave', `Yearly quota: ${num(d.quotas.casual)} casual + ${num(d.quotas.sick)} sick days (change in settings). Approved leave is marked in attendance automatically.`,
      can ? '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Add leave</button>' : '')}
    <div class="toolbar"><div class="seg-tabs">${[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => `<a href="#/leaves?status=${v}&year=${year}" class="${v === status ? 'on' : ''}">${l}</a>`).join('')}</div></div>
    <section class="panel">
      ${d.leaves.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th class="r">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.leaves.map((l) => `<tr>
          <td><a class="person" href="#/employees/${l.employee_id}"><span class="avatar sm">${esc((l.erp_employees?.full_name || '?').charAt(0))}</span><div><b>${esc(l.erp_employees?.full_name)}</b><small>${esc(l.erp_employees?.designation || '')}</small></div></a></td>
          <td>${LT[l.leave_type]}</td><td>${fdate(l.from_date)}${l.to_date !== l.from_date ? ' → ' + fdate(l.to_date) : ''}</td><td class="r">${num(l.days)}</td>
          <td>${esc(l.reason || '—')}</td><td>${leaveBadge(l.status)}${l.decided_by ? `<small class="block muted">by ${esc(l.decided_by)}</small>` : ''}</td>
          <td class="r nowrap">${can && l.status === 'pending' ? `<button class="btn btn-primary btn-xs" data-act="approved" data-id="${l.id}">Approve</button> <button class="btn btn-ghost btn-xs" data-act="rejected" data-id="${l.id}">Reject</button>`
            : can && l.status === 'approved' ? `<button class="btn btn-ghost btn-xs" data-act="cancelled" data-id="${l.id}">Cancel</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>`
      : empty('fa-umbrella-beach', status === 'pending' ? 'No pending leave requests. Employees can apply from the employee portal (/erp/me).' : 'Nothing here.')}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Leave balance · ${year}</h2>
        <div class="date-nav"><a class="icon-btn" href="#/leaves?status=${status}&year=${+year - 1}" aria-label="Previous year"><i class="fas fa-chevron-left"></i></a><b>${year}</b><a class="icon-btn" href="#/leaves?status=${status}&year=${+year + 1}" aria-label="Next year"><i class="fas fa-chevron-right"></i></a></div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Employee</th><th class="r">Casual left</th><th class="r">Sick left</th><th class="r">Unpaid taken</th><th class="r">Pending</th></tr></thead>
        <tbody>${d.balances.map((b) => `<tr><td><b>${esc(b.full_name)}</b></td>
          <td class="r ${b.casual.left <= 0 ? 't-red' : ''}">${num(b.casual.left)} / ${num(b.casual.quota)}</td>
          <td class="r ${b.sick.left <= 0 ? 't-red' : ''}">${num(b.sick.left)} / ${num(b.sick.quota)}</td>
          <td class="r">${num(b.unpaid.used)}</td><td class="r">${num(b.casual.pending + b.sick.pending + b.unpaid.pending)}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;

  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    if (act === 'cancelled' && !confirm('Cancel this approved leave? The attendance entries for those days will be removed.')) return;
    b.disabled = true;
    try { const r = await api.put('leaves', b.dataset.id, { status: act }); toast(r.message); refresh(); } catch (err) { toastErr(err); b.disabled = false; }
  }));
  root.querySelector('#add')?.addEventListener('click', () => formModal({
    title: 'Add leave', submitLabel: 'Add & approve',
    fields: [
      { name: 'employee_id', label: 'Employee', type: 'select', required: true, blank: '— Select —', options: employees.filter((e) => e.status === 'active').map((e) => [e.id, e.full_name]) },
      { name: 'leave_type', label: 'Type', type: 'select', blank: false, default: 'casual', options: [['casual', 'Casual (paid)'], ['sick', 'Sick (paid)'], ['unpaid', 'Unpaid']] },
      { name: 'from_date', label: 'From', type: 'date', required: true, default: ymd(new Date()) },
      { name: 'to_date', label: 'To', type: 'date', required: true, default: ymd(new Date()) },
      { name: 'reason', label: 'Reason', type: 'textarea', span: 2, rows: 2 },
    ],
    onSubmit: async (v) => { const r = await api.post('leaves', { ...v, approve: true }); toast(r.message); refresh(); },
  }));
}

// ================================================================ ADVANCES
export async function advancesView(root, _p, _q, alive) {
  const [{ advances }, { employees }] = await Promise.all([api.get('advances'), api.get('employees')]);
  if (!alive()) return;
  const can = canEdit('advances');
  const open = advances.filter((a) => a.balance > 0);
  root.innerHTML = `
    ${pageHead('Advances & loans', `${money(open.reduce((t, a) => t + a.balance, 0))} still to recover · deducted automatically in payroll each month`,
      can ? '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Give advance</button>' : '')}
    ${advances.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Employee</th><th>Given on</th><th class="r">Amount</th><th class="r">Per month</th><th class="r">Recovered</th><th class="r">Balance</th><th>Progress</th><th></th></tr></thead>
      <tbody>${advances.map((a) => `<tr>
        <td><b>${esc(a.erp_employees?.full_name)}</b>${a.note ? `<small class="block muted">${esc(a.note)}</small>` : ''}</td><td>${fdate(a.given_on)}</td>
        <td class="r">${money(a.amount)}</td><td class="r">${money(a.monthly_deduction)}</td><td class="r">${money(a.recovered)}</td>
        <td class="r"><b>${money(a.balance)}</b></td>
        <td style="min-width:120px"><div class="meter"><span style="width:${Math.min(100, (a.recovered / a.amount) * 100)}%"></span></div></td>
        <td class="r nowrap">${can && a.balance > 0 ? `<button class="icon-btn" data-edit="${a.id}" aria-label="Edit"><i class="fas fa-pen"></i></button>` : ''}${can && Number(a.recovered) === 0 ? `<button class="icon-btn" data-del="${a.id}" aria-label="Delete"><i class="fas fa-trash"></i></button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`
    : empty('fa-hand-holding-dollar', 'No advances given.', can ? '<button class="btn btn-primary" id="add2">Give an advance</button>' : '')}
    <p class="muted small mt">Recovery is taken when a payslip is marked paid (never more than the net pay). Undoing a paid payslip puts the amount back.</p>`;

  const add = () => formModal({
    title: 'Give salary advance', submitLabel: 'Save',
    fields: [
      { name: 'employee_id', label: 'Employee', type: 'select', required: true, blank: '— Select —', options: employees.filter((e) => e.status === 'active').map((e) => [e.id, e.full_name]) },
      { name: 'given_on', label: 'Given on', type: 'date', required: true, default: ymd(new Date()) },
      { name: 'amount', label: 'Amount (₹)', type: 'number', step: '0.01', required: true },
      { name: 'monthly_deduction', label: 'Deduct per month (₹)', type: 'number', step: '0.01', required: true },
      { name: 'note', label: 'Note', type: 'textarea', span: 2, rows: 2 },
    ],
    onSubmit: async (v) => { const r = await api.post('advances', v); toast(r.message); dispatchEvent(new Event('erp:refresh')); },
  });
  root.querySelector('#add')?.addEventListener('click', add);
  root.querySelector('#add2')?.addEventListener('click', add);
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const a = advances.find((x) => String(x.id) === b.dataset.edit);
    formModal({
      title: `Edit advance · ${a.erp_employees?.full_name}`, wide: false, values: a,
      fields: [{ name: 'monthly_deduction', label: 'Deduct per month (₹)', type: 'number', step: '0.01', required: true }, { name: 'note', label: 'Note', type: 'textarea', rows: 2 }],
      onSubmit: async (v) => { const r = await api.put('advances', a.id, v); toast(r.message); dispatchEvent(new Event('erp:refresh')); },
    });
  }));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this advance?')) return;
    try { const r = await api.del('advances', { id: b.dataset.del }); toast(r.message); dispatchEvent(new Event('erp:refresh')); } catch (err) { toastErr(err); }
  }));
}

// ================================================================ TIMESHEETS
export async function timesheetsView(root, _p, query, alive) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : ymd(new Date());
  const [{ entries }, { employees }, { products }] = await Promise.all([api.get('timesheets', { date }), api.get('employees'), api.get('products')]);
  if (!alive()) return;
  const active = employees.filter((e) => e.status === 'active');
  const openProducts = products.filter((p) => p.status !== 'completed');
  const shift = (n) => { const d = parseYmd(date); d.setDate(d.getDate() + n); return ymd(d); };
  const byEmp = new Map();
  entries.forEach((e) => { if (!byEmp.has(e.employee_id)) byEmp.set(e.employee_id, []); byEmp.get(e.employee_id).push(e); });
  const can = canEdit('timesheets');

  root.innerHTML = `
    ${pageHead('Timesheets', `${parseYmd(date).toLocaleDateString('en-IN', { weekday: 'long' })}, ${fdate(date)} · split a person's day across several products by hours`)}
    <div class="toolbar"><div class="date-nav">
      <a class="icon-btn" href="#/timesheets?date=${shift(-1)}" aria-label="Previous day"><i class="fas fa-chevron-left"></i></a>
      <input type="date" id="date" value="${date}">
      <a class="icon-btn" href="#/timesheets?date=${shift(1)}" aria-label="Next day"><i class="fas fa-chevron-right"></i></a>
    </div></div>
    <p class="muted small" style="margin:-6px 0 14px">If someone logs hours here, their day's cost is split by those hours. Otherwise the "Worked on" product from attendance gets the whole day. Employees can log their own hours in the employee portal.</p>
    ${active.length ? `<div class="ts-list">${active.map((e) => {
      const rows = byEmp.get(e.id) || [];
      const total = rows.reduce((t, r) => t + Number(r.hours), 0);
      return `<section class="panel ts-card" data-emp="${e.id}">
        <div class="panel-head"><h2>${esc(e.full_name)} <small class="muted">${esc(e.designation || '')}</small></h2><span class="badge ${total ? 'badge-violet' : 'badge-grey'}">${num(total)} h</span></div>
        <div class="ts-rows">${(rows.length ? rows : [{}]).map((r) => tsRow(r, openProducts, can)).join('')}</div>
        ${can ? `<div class="ts-actions"><button class="btn btn-ghost btn-sm" data-addrow><i class="fas fa-plus"></i> Add row</button><button class="btn btn-primary btn-sm" data-save><i class="fas fa-floppy-disk"></i> Save</button></div>` : ''}
      </section>`;
    }).join('')}</div>` : empty('fa-users', 'No active employees.')}`;

  root.querySelector('#date').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/timesheets?date=' + e.target.value; });
  root.querySelectorAll('.ts-card').forEach((card) => {
    card.querySelector('[data-addrow]')?.addEventListener('click', () => card.querySelector('.ts-rows').insertAdjacentHTML('beforeend', tsRow({}, openProducts, can)));
    card.addEventListener('click', (e) => { if (e.target.closest('[data-rmrow]')) e.target.closest('.ts-row').remove(); });
    card.querySelector('[data-save]')?.addEventListener('click', async (ev) => {
      const entries2 = [...card.querySelectorAll('.ts-row')].map((r) => ({
        product_id: r.querySelector('select').value, hours: r.querySelector('.h').value, note: r.querySelector('.n').value,
      })).filter((x) => x.product_id && Number(x.hours) > 0);
      ev.currentTarget.disabled = true;
      try { const r = await api.post('timesheets', { employee_id: card.dataset.emp, date, entries: entries2 }); toast(r.message); dispatchEvent(new Event('erp:refresh')); }
      catch (err) { toastErr(err); ev.currentTarget.disabled = false; }
    });
  });
}

function tsRow(r, products, can) {
  return `<div class="ts-row">
    <select aria-label="Product" ${can ? '' : 'disabled'}><option value="">— Product —</option>${products.map((p) => `<option value="${p.id}" ${String(p.id) === String(r.product_id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <input class="h" type="number" min="0" max="24" step="0.25" inputmode="decimal" placeholder="Hours" value="${esc(r.hours ?? '')}" aria-label="Hours" ${can ? '' : 'disabled'}>
    <input class="n" placeholder="What was done (optional)" value="${esc(r.note ?? '')}" aria-label="Note" ${can ? '' : 'disabled'}>
    ${can ? '<button class="icon-btn" data-rmrow aria-label="Remove row"><i class="fas fa-xmark"></i></button>' : ''}
  </div>`;
}
