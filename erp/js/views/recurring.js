import { api, esc, money, fdate, badge, pageHead, empty, toast, toastErr, canEdit } from '../core.js';
import { computeInvoice, ymd } from '../calc.js';

const every = (n) => (n === 1 ? 'Monthly' : n === 3 ? 'Quarterly' : n === 6 ? 'Half-yearly' : n === 12 ? 'Yearly' : `Every ${n} months`);

export async function recurringList(root, _p, _q, alive) {
  const { recurring } = await api.get('recurring');
  if (!alive()) return;
  const can = canEdit('recurring');
  const mrr = recurring.filter((r) => r.active).reduce((t, r) => t + computeInvoice({ items: r.items, gstRate: 0, discount: r.discount }).total / r.interval_months, 0);
  root.innerHTML = `
    ${pageHead('Recurring billing', `Retainers, hosting, maintenance — invoices are created automatically every morning (9 AM IST). ~${money(mrr)} / month before GST.`,
      can ? '<a class="btn btn-primary" href="#/recurring/new"><i class="fas fa-plus"></i> New schedule</a>' : '')}
    ${recurring.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Schedule</th><th>Client</th><th>Frequency</th><th class="r">Amount (pre-GST)</th><th>Next invoice</th><th>Email</th><th>Status</th><th></th></tr></thead>
      <tbody>${recurring.map((r) => `<tr class="click" data-href="#/recurring/${r.id}">
        <td><b>${esc(r.title)}</b>${r.erp_products ? `<small class="block muted">${esc(r.erp_products.name)}</small>` : ''}</td>
        <td>${esc(r.erp_clients?.company || r.erp_clients?.name)}</td><td>${every(r.interval_months)}</td>
        <td class="r">${money(computeInvoice({ items: r.items, gstRate: 0, discount: r.discount }).total)}</td>
        <td>${r.active ? fdate(r.next_date) : '—'}${r.end_date ? `<small class="block muted">ends ${fdate(r.end_date)}</small>` : ''}</td>
        <td>${r.auto_send ? '<i class="fas fa-envelope t-green" title="Emailed automatically"></i>' : '<span class="muted small">draft only</span>'}</td>
        <td>${badge(r.active ? 'active' : 'draft', r.active ? 'active' : 'paused')}</td>
        <td class="r">${can && r.active ? `<button class="btn btn-ghost btn-xs" data-run="${r.id}">Generate now</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>` : empty('fa-repeat', 'No recurring invoices yet. Set one up for monthly retainers, AMC or hosting.', can ? '<a class="btn btn-primary" href="#/recurring/new">New schedule</a>' : '')}`;
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => {
    const run = e.target.closest('[data-run]');
    if (run) { e.stopPropagation(); runNow(run, run.dataset.run); return; }
    location.hash = tr.dataset.href;
  }));
}

async function runNow(btn, id) {
  if (!confirm('Create the next invoice from this schedule right now?')) return;
  btn.disabled = true;
  try { const r = await api.post('recurring', {}, { action: 'run', id }); toast(r.message); location.hash = '#/invoices/' + r.invoice.id; }
  catch (err) { toastErr(err); btn.disabled = false; }
}

export async function recurringEditor(root, params, _q, alive) {
  const id = params[0];
  const [{ clients }, { products }, existing] = await Promise.all([
    api.get('clients'), api.get('products'), id ? api.get('recurring', { id }) : Promise.resolve(null),
  ]);
  if (!alive()) return;
  if (!clients.length) { root.innerHTML = pageHead('New schedule') + empty('fa-handshake', 'Add a client first.', '<a class="btn btn-primary" href="#/clients">Add client</a>'); return; }
  const r = existing?.recurring || {
    title: '', client_id: '', product_id: '', items: [{ description: '', hsn_sac: '998314', quantity: 1, rate: '' }], gst_rate: 18, tax_mode: 'auto',
    discount: 0, notes: '', interval_months: 1, due_days: 15, next_date: ymd(new Date()), end_date: '', active: true, auto_send: true,
  };
  const items = r.items.map((i) => ({ ...i }));
  const can = canEdit('recurring');

  root.innerHTML = `
    ${pageHead(id ? r.title : 'New recurring invoice', id ? `${every(r.interval_months)} · next on ${fdate(r.next_date)}` : 'An invoice is created on each "next invoice date", then the date moves forward.',
      `<a class="btn btn-ghost" href="#/recurring"><i class="fas fa-arrow-left"></i> Back</a>
       ${id && can ? '<button class="btn btn-ghost danger" id="del" aria-label="Delete"><i class="fas fa-trash"></i></button>' : ''}
       ${id && can && r.active ? '<button class="btn btn-ghost" id="run"><i class="fas fa-bolt"></i> Generate now</button>' : ''}`)}
    <form class="panel" id="rf" novalidate>
      <div class="form-grid">
        <div class="field span-2"><label for="title">Name <b>*</b></label><input id="title" required placeholder="e.g. SEO retainer – Blr Tech" value="${esc(r.title)}"></div>
        <div class="field"><label for="client">Client <b>*</b></label><select id="client"><option value="">— Select —</option>${clients.map((c) => `<option value="${c.id}" ${String(c.id) === String(r.client_id) ? 'selected' : ''}>${esc(c.company || c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="product">Product / project</label><select id="product"><option value="">— None —</option>${products.map((p) => `<option value="${p.id}" ${String(p.id) === String(r.product_id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="interval">Frequency</label><select id="interval">${[[1, 'Monthly'], [2, 'Every 2 months'], [3, 'Quarterly'], [6, 'Half-yearly'], [12, 'Yearly']].map(([v, l]) => `<option value="${v}" ${Number(r.interval_months) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="next">Next invoice date <b>*</b></label><input type="date" id="next" value="${esc(r.next_date)}"></div>
        <div class="field"><label for="due">Payment due after (days)</label><input type="number" id="due" min="0" max="120" value="${esc(r.due_days)}"></div>
        <div class="field"><label for="end">End date (optional)</label><input type="date" id="end" value="${esc(r.end_date || '')}"></div>
      </div>
      <div class="table-wrap mt"><table class="table items">
        <thead><tr><th style="width:50%">Description</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th></th></tr></thead>
        <tbody id="items"></tbody></table></div>
      <button type="button" class="btn btn-ghost btn-sm mt" id="addItem"><i class="fas fa-plus"></i> Add line</button>
      <div class="form-grid mt">
        <div class="field"><label for="gst">GST rate</label><select id="gst">${[0, 5, 12, 18, 28].map((x) => `<option value="${x}" ${Number(r.gst_rate) === x ? 'selected' : ''}>${x}%</option>`).join('')}</select></div>
        <div class="field"><label for="disc">Discount (₹)</label><input type="number" id="disc" step="0.01" min="0" value="${esc(r.discount || '')}"></div>
        <div class="field span-2"><label class="check"><input type="checkbox" id="nogst" ${r.tax_mode === 'none' ? 'checked' : ''}> No GST</label></div>
        <div class="field span-2"><label class="check"><input type="checkbox" id="auto" ${r.auto_send ? 'checked' : ''}> Email each invoice to the client automatically (otherwise it is saved as a draft for you to review)</label></div>
        <div class="field span-2"><label class="check"><input type="checkbox" id="active" ${r.active ? 'checked' : ''}> Active</label></div>
        <div class="field span-2"><label for="notes">Notes on invoice</label><textarea id="notes" rows="2">${esc(r.notes || '')}</textarea></div>
      </div>
      ${can ? '<div class="form-actions"><button class="btn btn-primary" type="submit"><i class="fas fa-floppy-disk"></i> Save schedule</button></div>' : ''}
    </form>
    ${existing?.invoices?.length ? `<section class="panel"><div class="panel-head"><h2>Invoices created</h2></div><div class="table-wrap"><table class="table">
      <thead><tr><th>Invoice</th><th>Date</th><th class="r">Total</th><th>Status</th></tr></thead>
      <tbody>${existing.invoices.map((i) => `<tr class="click" data-href="#/invoices/${i.id}"><td><b>${esc(i.invoice_no)}</b></td><td>${fdate(i.issue_date)}</td><td class="r">${money(i.total)}</td><td>${badge(i.status)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;

  const tbody = root.querySelector('#items');
  const draw = () => {
    tbody.innerHTML = items.map((it, i) => `<tr data-i="${i}">
      <td><input data-k="description" value="${esc(it.description)}" placeholder="e.g. Monthly SEO retainer" aria-label="Description"></td>
      <td><input data-k="hsn_sac" value="${esc(it.hsn_sac || '')}" class="w-sm" aria-label="HSN/SAC"></td>
      <td><input data-k="quantity" type="number" step="0.01" value="${esc(it.quantity)}" class="r w-xs" aria-label="Quantity"></td>
      <td><input data-k="rate" type="number" step="0.01" value="${esc(it.rate)}" class="r w-sm" aria-label="Rate"></td>
      <td class="r"><button type="button" class="icon-btn" data-del ${items.length === 1 ? 'disabled' : ''} aria-label="Remove"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    tbody.querySelectorAll('tr').forEach((tr) => {
      const i = Number(tr.dataset.i);
      tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => { items[i][inp.dataset.k] = inp.value; }));
      tr.querySelector('[data-del]').addEventListener('click', () => { items.splice(i, 1); draw(); });
    });
  };
  draw();
  root.querySelector('#addItem').addEventListener('click', () => { items.push({ description: '', hsn_sac: items.at(-1)?.hsn_sac || '', quantity: 1, rate: '' }); draw(); });
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  root.querySelector('#run')?.addEventListener('click', (e) => runNow(e.currentTarget, id));
  root.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm('Delete this schedule? Invoices already created stay.')) return;
    try { const x = await api.del('recurring', { id }); toast(x.message); location.hash = '#/recurring'; } catch (err) { toastErr(err); }
  });
  root.querySelector('#rf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const $ = (s) => root.querySelector(s);
    const body = {
      title: $('#title').value, client_id: $('#client').value, product_id: $('#product').value || null,
      interval_months: $('#interval').value, next_date: $('#next').value, due_days: $('#due').value || 15, end_date: $('#end').value || null,
      gst_rate: $('#gst').value, tax_mode: $('#nogst').checked ? 'none' : 'auto', discount: $('#disc').value || 0,
      auto_send: $('#auto').checked, active: $('#active').checked, notes: $('#notes').value, items,
    };
    if (!body.title.trim() || !body.client_id || !body.next_date) { toast('Name, client and next date are required.', 'err'); return; }
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const x = id ? await api.put('recurring', id, body) : await api.post('recurring', body);
      toast(x.message); location.hash = '#/recurring';
    } catch (err) { toastErr(err); if (btn) btn.disabled = false; }
  });
}
