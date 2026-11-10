import { api, esc, money, fdate, fmonth, num, badge, pageHead, empty, formModal, toast, toastErr, downloadCsv, canEdit } from '../core.js';
import { ymd, parseYmd } from '../calc.js';
import { payslipDoc } from '../docs.js';

const dedTotal = (r) => Number(r.deductions) + Number(r.pf || 0) + Number(r.esi || 0) + Number(r.tds || 0) + Number(r.advance_deduction || 0);
const dedParts = (r) => [['PF', r.pf], ['ESI', r.esi], ['TDS', r.tds], ['Adv', r.advance_deduction], ['Other', r.deductions]]
  .filter(([, v]) => Number(v)).map(([k, v]) => `${k} ${money(v)}`).join(' · ');

const MODES = [['Bank transfer', 'Bank transfer'], ['UPI', 'UPI'], ['Cash', 'Cash'], ['Cheque', 'Cheque']];

export async function payrollView(root, _p, query, alive) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : ymd(new Date()).slice(0, 7);
  const d = await api.get('payroll', { month });
  if (!alive()) return;
  const rows = d.rows;
  const sum = (k) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
  const unmarked = sum('unmarked_days');
  const drafts = rows.filter((r) => r.status === 'draft');
  const shift = (n) => { const x = parseYmd(month + '-01'); x.setMonth(x.getMonth() + n); return ymd(x).slice(0, 7); };

  root.innerHTML = `
    ${pageHead('Payroll', `${fmonth(month)} · salary = monthly salary × paid days ÷ working days`,
      `${rows.length ? '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export</button>' : ''}
       <button class="btn btn-primary" id="gen"><i class="fas fa-calculator"></i> ${rows.length ? 'Recalculate' : 'Generate payroll'}</button>`)}
    <div class="toolbar">
      <div class="date-nav">
        <a class="icon-btn" href="#/payroll?month=${shift(-1)}" aria-label="Previous month"><i class="fas fa-chevron-left"></i></a>
        <input type="month" id="month" value="${month}">
        <a class="icon-btn" href="#/payroll?month=${shift(1)}" aria-label="Next month"><i class="fas fa-chevron-right"></i></a>
      </div>
      ${drafts.length ? `<button class="btn btn-ghost btn-sm" id="payAll"><i class="fas fa-check-double"></i> Mark all ${drafts.length} as paid</button>` : ''}
    </div>
    ${unmarked ? `<div class="alert alert-warn"><i class="fas fa-triangle-exclamation"></i><div><b>${num(unmarked)} working day(s) have no attendance.</b> Those days are not paid. Mark attendance, then click Recalculate.
      <a href="#/attendance/month?month=${month}">Open monthly sheet →</a></div></div>` : ''}
    ${rows.length ? `
      <div class="stats stats-4">
        <div class="stat"><span class="stat-label">Employees</span><span class="stat-val">${rows.length}</span></div>
        <div class="stat"><span class="stat-label">Gross earned</span><span class="stat-val">${money(sum('earned'))}</span></div>
        <div class="stat"><span class="stat-label">Net payable</span><span class="stat-val">${money(sum('net_pay'))}</span></div>
        <div class="stat"><span class="stat-label">Paid so far</span><span class="stat-val">${money(rows.filter((r) => r.status === 'paid').reduce((t, r) => t + Number(r.net_pay), 0))}</span></div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Employee</th><th class="r">Paid days</th><th class="r">Salary</th><th class="r">Earned</th><th class="r">+ Allow. / Bonus</th><th class="r">− Deduct.</th><th class="r">Net pay</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr data-id="${r.id}">
            <td><div class="person"><span class="avatar sm">${esc((r.erp_employees?.full_name || '?').charAt(0))}</span><div><b>${esc(r.erp_employees?.full_name)}</b><small>${esc(r.erp_employees?.emp_code)} · ${esc(r.erp_employees?.designation || '')}</small></div></div></td>
            <td class="r"><b>${num(r.paid_days)}</b> / ${num(r.working_days)}${Number(r.unmarked_days) ? `<small class="block t-red">${num(r.unmarked_days)} unmarked</small>` : ''}</td>
            <td class="r">${money(r.monthly_salary)}</td>
            <td class="r">${money(r.earned)}</td>
            <td class="r">${money(Number(r.allowances) + Number(r.bonus))}</td>
            <td class="r">${money(dedTotal(r))}${dedParts(r) ? `<small class="block muted">${dedParts(r)}</small>` : ''}</td>
            <td class="r"><b>${money(r.net_pay)}</b></td>
            <td>${badge(r.status)}${r.paid_on ? `<small class="block muted">${fdate(r.paid_on)}</small>` : ''}</td>
            <td class="r nowrap">
              <a class="icon-btn" href="#/payslip/${r.id}" title="Payslip" aria-label="Payslip"><i class="fas fa-file-lines"></i></a>
              ${r.status === 'draft'
                ? `<button class="icon-btn" data-act="adjust" title="Allowances, bonus, deductions" aria-label="Adjust"><i class="fas fa-sliders"></i></button>
                   <button class="btn btn-primary btn-xs" data-act="pay">Pay</button>`
                : `<button class="btn btn-ghost btn-xs" data-act="unpay">Undo paid</button>`}
            </td>
          </tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td></td><td class="r">${money(sum('monthly_salary'))}</td><td class="r">${money(sum('earned'))}</td><td class="r">${money(sum('allowances') + sum('bonus'))}</td><td class="r">${money(rows.reduce((t, r) => t + dedTotal(r), 0))}</td><td class="r">${money(sum('net_pay'))}</td><td colspan="2"></td></tr></tfoot>
      </table></div>`
    : empty('fa-money-check-dollar', `No payroll for ${fmonth(month)} yet. Mark attendance for the month, then generate payroll.`,
      '<button class="btn btn-primary" id="gen2"><i class="fas fa-calculator"></i> Generate payroll</button>')}`;

  const refresh = () => dispatchEvent(new Event('erp:refresh'));
  const generate = async (btn) => {
    btn.disabled = true;
    try { const r = await api.post('payroll', { month }); toast(r.message, /Warning/.test(r.message) ? 'warn' : 'ok'); refresh(); }
    catch (err) { toastErr(err); btn.disabled = false; }
  };
  root.querySelector('#gen').addEventListener('click', (e) => generate(e.currentTarget));
  root.querySelector('#gen2')?.addEventListener('click', (e) => generate(e.currentTarget));
  root.querySelector('#month').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/payroll?month=' + e.target.value; });

  root.querySelector('#csv')?.addEventListener('click', () => downloadCsv(`uxonic-payroll-${month}.csv`, [
    ['Code', 'Employee', 'Designation', 'Working days', 'Paid days', 'Unmarked', 'Monthly salary', 'Earned', 'Allowances', 'Bonus', 'PF', 'ESI', 'TDS', 'Advance recovery', 'Other deductions', 'Net pay', 'Status', 'Paid on', 'Mode', 'Bank account', 'IFSC'],
    ...rows.map((r) => [r.erp_employees?.emp_code, r.erp_employees?.full_name, r.erp_employees?.designation, r.working_days, r.paid_days, r.unmarked_days,
      r.monthly_salary, r.earned, r.allowances, r.bonus, r.pf, r.esi, r.tds, r.advance_deduction, r.deductions, r.net_pay, r.status, r.paid_on, r.payment_mode, r.erp_employees?.bank_account, r.erp_employees?.bank_ifsc]),
  ]));

  root.querySelector('#payAll')?.addEventListener('click', () => formModal({
    title: `Mark ${drafts.length} payslip(s) as paid`, wide: false, submitLabel: 'Mark paid',
    fields: [
      { name: 'paid_on', label: 'Paid on', type: 'date', default: ymd(new Date()), required: true },
      { name: 'payment_mode', label: 'Payment mode', type: 'select', options: MODES, default: 'Bank transfer', blank: false },
    ],
    onSubmit: async (v) => {
      for (const r of drafts) await api.put('payroll', r.id, { status: 'paid', ...v });
      toast(`${drafts.length} payslip(s) marked paid.`); refresh();
    },
  }));

  root.querySelectorAll('tr[data-id] [data-act]').forEach((b) => b.addEventListener('click', async () => {
    const row = rows.find((r) => String(r.id) === b.closest('tr').dataset.id);
    const act = b.dataset.act;
    if (act === 'adjust') {
      formModal({
        title: `Adjust · ${row.erp_employees?.full_name}`, wide: false,
        fields: [
          { name: 'allowances', label: 'Allowances (₹)', type: 'number', step: '0.01', hint: 'Travel, internet, food…' },
          { name: 'bonus', label: 'Bonus / incentive (₹)', type: 'number', step: '0.01' },
          { name: 'deductions', label: 'Other deductions (₹)', type: 'number', step: '0.01', hint: 'PF, ESI, TDS and advances are calculated automatically' },
          { name: 'notes', label: 'Notes (shown on payslip)', type: 'textarea', rows: 2 },
        ],
        values: row,
        onSubmit: async (v) => {
          await api.put('payroll', row.id, { allowances: v.allowances || 0, bonus: v.bonus || 0, deductions: v.deductions || 0, notes: v.notes });
          toast('Payroll updated.'); refresh();
        },
      });
    } else if (act === 'pay') {
      formModal({
        title: `Pay ${row.erp_employees?.full_name} · ${money(row.net_pay)}`, wide: false, submitLabel: 'Mark paid',
        fields: [
          { name: 'paid_on', label: 'Paid on', type: 'date', default: ymd(new Date()), required: true },
          { name: 'payment_mode', label: 'Payment mode', type: 'select', options: MODES, default: 'Bank transfer', blank: false },
        ],
        onSubmit: async (v) => { await api.put('payroll', row.id, { status: 'paid', ...v }); toast('Marked paid.'); refresh(); },
      });
    } else if (act === 'unpay') {
      if (!confirm('Mark this payslip as unpaid (draft) again?')) return;
      try { await api.put('payroll', row.id, { status: 'draft' }); toast('Moved back to draft.'); refresh(); } catch (err) { toastErr(err); }
    }
  }));
}

export async function payslipView(root, [id], _q, alive) {
  const { payslip: p, settings: s } = await api.get('payroll', { id });
  if (!alive()) return;
  root.innerHTML = `
    <div class="page-head no-print">
      <div><h1>Payslip</h1><p>${esc(p.erp_employees?.full_name)} · ${fmonth(p.month)}</p></div>
      <div class="page-actions">
        <a class="btn btn-ghost" href="#/payroll?month=${String(p.month).slice(0, 7)}"><i class="fas fa-arrow-left"></i> Payroll</a>
        <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print / Save PDF</button>
      </div>
    </div>
    ${payslipDoc(p, s)}`;
}
