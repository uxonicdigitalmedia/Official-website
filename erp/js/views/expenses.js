import { api, esc, money, fdate, fmonth, pageHead, empty, formModal, toast, toastErr, downloadCsv, canEdit } from '../core.js';
import { ymd, parseYmd } from '../calc.js';

export async function expensesView(root, _p, query, alive) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : ymd(new Date()).slice(0, 7);
  const [d, { products }] = await Promise.all([api.get('expenses', { month }), api.get('products')]);
  if (!alive()) return;
  const shift = (n) => { const x = parseYmd(month + '-01'); x.setMonth(x.getMonth() + n); return ymd(x).slice(0, 7); };
  const max = Math.max(1, ...d.totals.by_category.map((c) => c.amount));
  const can = canEdit('expenses');

  const fields = [
    { name: 'date', label: 'Date', type: 'date', required: true, default: ymd(new Date()) },
    { name: 'category', label: 'Category', type: 'select', required: true, blank: '— Select —', options: d.categories.map((c) => [c, c]) },
    { name: 'amount', label: 'Total paid (₹, incl. GST)', type: 'number', step: '0.01', required: true },
    { name: 'gst_amount', label: 'GST in that amount (₹)', type: 'number', step: '0.01', hint: 'From the vendor\'s GST bill — claimable as input tax credit' },
    { name: 'vendor', label: 'Paid to (vendor)', placeholder: 'e.g. AWS, Landlord' },
    { name: 'payment_mode', label: 'Payment mode', type: 'select', blank: '—', options: [['Bank transfer', 'Bank transfer'], ['UPI', 'UPI'], ['Card', 'Card'], ['Cash', 'Cash'], ['Cheque', 'Cheque']] },
    { name: 'product_id', label: 'For product / project (optional)', type: 'select', blank: '— General / office —', options: products.map((p) => [p.id, p.name]), hint: 'Counts against that product\'s profit' },
    { name: 'reference', label: 'Bill / reference no.' },
    { name: 'description', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
  ];
  const edit = (x) => formModal({
    title: x ? 'Edit expense' : 'Add expense', fields, values: x || {}, submitLabel: x ? 'Save' : 'Add expense',
    onSubmit: async (v) => {
      const r = x ? await api.put('expenses', x.id, v) : await api.post('expenses', v);
      toast(r.message); dispatchEvent(new Event('erp:refresh'));
    },
  });

  root.innerHTML = `
    ${pageHead('Expenses', `${fmonth(month)} · ${money(d.totals.amount)} spent · ${money(d.totals.gst)} GST input credit`,
      `${d.expenses.length ? '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export</button>' : ''}
       ${can ? '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Add expense</button>' : ''}`)}
    <div class="toolbar">
      <div class="date-nav">
        <a class="icon-btn" href="#/expenses?month=${shift(-1)}" aria-label="Previous month"><i class="fas fa-chevron-left"></i></a>
        <input type="month" id="month" value="${month}">
        <a class="icon-btn" href="#/expenses?month=${shift(1)}" aria-label="Next month"><i class="fas fa-chevron-right"></i></a>
      </div>
    </div>
    ${d.expenses.length ? `
    <div class="grid-2 grid-2-wide">
      <section class="panel">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Product</th><th class="r">GST</th><th class="r">Amount</th><th></th></tr></thead>
          <tbody>${d.expenses.map((x) => `<tr>
            <td>${fdate(x.date)}</td><td><b>${esc(x.category)}</b>${x.description ? `<small class="block muted">${esc(x.description)}</small>` : ''}</td>
            <td>${esc(x.vendor || '—')}<small class="block muted">${esc(x.payment_mode || '')}</small></td>
            <td>${x.erp_products ? esc(x.erp_products.name) : '<span class="muted">General</span>'}</td>
            <td class="r">${Number(x.gst_amount) ? money(x.gst_amount) : '—'}</td><td class="r"><b>${money(x.amount)}</b></td>
            <td class="r nowrap">${can ? `<button class="icon-btn" data-edit="${x.id}" aria-label="Edit"><i class="fas fa-pen"></i></button><button class="icon-btn" data-del="${x.id}" aria-label="Delete"><i class="fas fa-trash"></i></button>` : ''}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Total</td><td class="r">${money(d.totals.gst)}</td><td class="r">${money(d.totals.amount)}</td><td></td></tr></tfoot>
        </table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>By category</h2></div>
        <div class="bars">${d.totals.by_category.map((c) => `
          <div class="bar-row"><span class="bar-name">${esc(c.category)}</span><span class="bar-track"><span class="bar-fill" style="width:${(c.amount / max) * 100}%"></span></span><span class="bar-val">${money(c.amount)}</span></div>`).join('')}</div>
      </section>
    </div>` : empty('fa-receipt', `No expenses recorded for ${fmonth(month)}.`, can ? '<button class="btn btn-primary" id="add2">Add first expense</button>' : '')}`;

  root.querySelector('#month').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/expenses?month=' + e.target.value; });
  root.querySelector('#add')?.addEventListener('click', () => edit(null));
  root.querySelector('#add2')?.addEventListener('click', () => edit(null));
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(d.expenses.find((x) => String(x.id) === b.dataset.edit))));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this expense?')) return;
    try { const r = await api.del('expenses', { id: b.dataset.del }); toast(r.message); dispatchEvent(new Event('erp:refresh')); } catch (err) { toastErr(err); }
  }));
  root.querySelector('#csv')?.addEventListener('click', () => downloadCsv(`uxonic-expenses-${month}.csv`, [
    ['Date', 'Category', 'Vendor', 'Description', 'Product', 'Payment mode', 'Reference', 'GST', 'Amount'],
    ...d.expenses.map((x) => [x.date, x.category, x.vendor, x.description, x.erp_products?.name, x.payment_mode, x.reference, x.gst_amount, x.amount]),
  ]));
}
