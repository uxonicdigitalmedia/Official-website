import { api, esc, money, fdate, badge, pageHead, empty, formModal, toast, toastErr, waLink, canEdit } from '../core.js';
import { computeInvoice, taxTypeFor, ymd, parseYmd, round2 } from '../calc.js';
import { salesDoc } from '../docs.js';

const plusDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const STATUS_TABS = [['', 'All'], ['draft', 'Draft'], ['sent', 'Sent'], ['partially-paid', 'Part paid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['cancelled', 'Cancelled']];

// ---------------------------------------------------------------- list
export async function invoicesList(root, _p, query, alive) {
  const status = query.status || '';
  const { invoices } = await api.get('invoices', status ? { status } : {});
  if (!alive()) return;
  let search = '';
  const draw = () => {
    const s = search.toLowerCase();
    const rows = invoices.filter((i) => !s || [i.invoice_no, i.erp_clients?.name, i.erp_clients?.company, i.erp_products?.name].some((x) => String(x || '').toLowerCase().includes(s)));
    const total = rows.filter((i) => !['draft', 'cancelled'].includes(i.status)).reduce((t, i) => t + Number(i.total), 0);
    const due = rows.filter((i) => ['sent', 'partially-paid'].includes(i.status)).reduce((t, i) => t + Number(i.total) - Number(i.amount_paid), 0);
    root.innerHTML = `
      ${pageHead('Invoices', `${rows.length} invoice(s) · ${money(total)} billed · ${money(due)} due`,
        `<a class="btn btn-ghost" href="#/recurring"><i class="fas fa-repeat"></i> Recurring</a>
         <a class="btn btn-primary" href="#/invoices/new"><i class="fas fa-plus"></i> New invoice</a>`)}
      <div class="toolbar">
        <div class="seg-tabs scroll">${STATUS_TABS.map(([v, l]) => `<a href="#/invoices${v ? '?status=' + v : ''}" class="${v === status ? 'on' : ''}">${l}</a>`).join('')}</div>
        <label class="search"><i class="fas fa-magnifying-glass"></i><input id="q" placeholder="Search number, client, product…" value="${esc(search)}"></label>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Invoice</th><th>Client</th><th>Product</th><th>Date</th><th>Due</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead>
        <tbody>${rows.map((i) => `
          <tr class="click" data-href="#/invoices/${i.id}">
            <td><b>${esc(i.invoice_no)}</b></td>
            <td>${esc(i.erp_clients?.company || i.erp_clients?.name || '—')}</td>
            <td>${esc(i.erp_products?.name || '—')}</td>
            <td>${fdate(i.issue_date)}</td><td>${fdate(i.due_date)}</td>
            <td class="r">${money(i.total)}</td>
            <td class="r">${i.status === 'cancelled' ? '—' : money(Number(i.total) - Number(i.amount_paid))}</td>
            <td>${badge(i.effective_status)}</td>
          </tr>`).join('')}</tbody></table></div>`
      : empty('fa-file-invoice', invoices.length ? 'No invoices match.' : 'No invoices here yet.', '<a class="btn btn-primary" href="#/invoices/new">Create invoice</a>')}`;
    const q = root.querySelector('#q');
    q.addEventListener('input', () => { search = q.value; const pos = q.selectionStart; draw(); const n = root.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  };
  draw();
}

// ---------------------------------------------------------------- shared editor (invoice | quote)
export async function docEditor(root, params, query, alive, kind) {
  const isQuote = kind === 'quote';
  const res = isQuote ? 'quotes' : 'invoices';
  const base = isQuote ? '#/quotes' : '#/invoices';
  const label = isQuote ? 'quotation' : 'invoice';
  const dateKey = isQuote ? 'valid_until' : 'due_date';
  const editId = params[0];
  const [{ clients }, { products }, { settings: s }, existing] = await Promise.all([
    api.get('clients'), api.get('products'), api.get('settings'),
    editId ? api.get(res, { id: editId }) : Promise.resolve(null),
  ]);
  if (!alive()) return;
  const cur = existing && (isQuote ? existing.quote : existing.invoice);
  if (cur && (isQuote ? cur.status === 'converted' : ['paid', 'cancelled'].includes(cur.status))) {
    toast(`This ${label} can no longer be edited.`, 'warn');
    location.hash = `${base}/${editId}`; return;
  }
  if (!clients.length) {
    root.innerHTML = pageHead(`New ${label}`) + empty('fa-handshake', `Add a client first — every ${label} needs a client.`, '<a class="btn btn-primary" href="#/clients">Add client</a>');
    return;
  }

  const today = ymd(new Date());
  const st = {
    client_id: String(cur?.client_id || query.client || ''),
    product_id: String(cur?.product_id || query.product || ''),
    issue_date: cur?.issue_date || today,
    end_date: cur?.[dateKey] || plusDays(today, isQuote ? 30 : 15),
    gst_rate: String(cur?.gst_rate ?? s.default_gst_rate ?? 18),
    no_gst: cur ? cur.tax_type === 'none' : false,
    discount: cur?.discount ? String(cur.discount) : '',
    notes: cur?.notes ?? (isQuote ? 'Quotation valid for 30 days. 50% advance to start, balance on delivery.' : s.invoice_terms ?? ''),
    items: existing?.items?.length
      ? existing.items.map((i) => ({ description: i.description, hsn_sac: i.hsn_sac || '', quantity: String(i.quantity), rate: String(i.rate) }))
      : [{ description: '', hsn_sac: '998314', quantity: '1', rate: '' }],
  };
  if (!cur && st.product_id && !st.client_id) {
    const p = products.find((x) => String(x.id) === st.product_id);
    if (p?.client_id) st.client_id = String(p.client_id);
  }
  const clientOf = () => clients.find((c) => String(c.id) === st.client_id);

  root.innerHTML = `
    ${pageHead(cur ? `Edit ${isQuote ? cur.quote_no : cur.invoice_no}` : `New ${label}`, cur ? 'Changes recalculate GST automatically' : `The ${label} number is assigned when you save`,
      `<a class="btn btn-ghost" href="${cur ? `${base}/${cur.id}` : base}"><i class="fas fa-xmark"></i> Cancel</a>`)}
    <div class="inv-edit">
      <section class="panel">
        <div class="form-grid">
          <div class="field"><label for="client">Client <b>*</b></label>
            <select id="client"><option value="">— Select client —</option>${clients.map((c) => `<option value="${c.id}">${esc(c.company || c.name)}${c.state ? ' · ' + esc(c.state) : ''}</option>`).join('')}</select>
            <small><a href="#/clients" class="link">+ Add new client</a></small></div>
          <div class="field"><label for="product">Product / project</label>
            <select id="product"><option value="">— None —</option>${products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
            <small>Links revenue to the product's profit</small></div>
          <div class="field"><label for="issue">${isQuote ? 'Quotation' : 'Invoice'} date</label><input type="date" id="issue"></div>
          <div class="field"><label for="due">${isQuote ? 'Valid until' : 'Due date'}</label><input type="date" id="due"></div>
        </div>

        <div class="table-wrap mt"><table class="table items">
          <thead><tr><th style="width:44%">Description</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th class="r">Amount</th><th></th></tr></thead>
          <tbody id="items"></tbody>
        </table></div>
        <button class="btn btn-ghost btn-sm mt" id="addItem"><i class="fas fa-plus"></i> Add line</button>

        <div class="form-grid mt">
          <div class="field"><label for="gst">GST rate</label>
            <select id="gst">${[0, 5, 12, 18, 28].map((r) => `<option value="${r}">${r}%</option>`).join('')}</select></div>
          <div class="field"><label for="disc">Discount (₹)</label><input type="number" id="disc" step="0.01" min="0" inputmode="decimal" placeholder="0"></div>
          <div class="field span-2"><label class="check"><input type="checkbox" id="nogst"> No GST (export / unregistered)</label></div>
          <div class="field span-2"><label for="notes">Notes / terms (printed)</label><textarea id="notes" rows="3"></textarea></div>
        </div>
      </section>

      <aside class="panel totals-card">
        <h2>Summary</h2>
        <div id="totals"></div>
        <div class="stack mt">
          ${!cur || cur.status === 'draft' ? '<button class="btn btn-ghost" id="saveDraft"><i class="fas fa-floppy-disk"></i> Save as draft</button>' : ''}
          <button class="btn btn-primary" id="saveSend"><i class="fas fa-paper-plane"></i> ${cur && cur.status !== 'draft' ? 'Save changes' : 'Save &amp; mark sent'}</button>
          ${!cur ? `<label class="check small"><input type="checkbox" id="emailNow"> Also email it to the client</label>` : ''}
        </div>
        <p class="muted small mt">${esc(s.company_name)} · state code ${esc(s.state_code || '—')}${s.gstin ? '' : ' · <a class="link" href="#/settings">add your GSTIN</a>'}</p>
      </aside>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  $('#client').value = st.client_id; $('#product').value = st.product_id;
  $('#issue').value = st.issue_date; $('#due').value = st.end_date;
  $('#gst').value = st.gst_rate; $('#disc').value = st.discount; $('#nogst').checked = st.no_gst; $('#notes').value = st.notes;

  const calc = () => computeInvoice({
    items: st.items, gstRate: st.no_gst ? 0 : Number(st.gst_rate), discount: st.discount || 0,
    taxType: st.no_gst ? 'none' : taxTypeFor(s.state_code, clientOf()?.state_code),
  });
  const drawTotals = () => {
    const c = calc();
    const line = (l, v, cls = '') => `<div class="tot-line ${cls}"><span>${l}</span><b>${v}</b></div>`;
    $('#totals').innerHTML =
      line('Subtotal', money(c.subtotal)) +
      (c.discount ? line('Discount', '− ' + money(c.discount)) : '') +
      (c.tax_type === 'cgst_sgst' ? line(`CGST ${c.gst_rate / 2}%`, money(c.cgst)) + line(`SGST ${c.gst_rate / 2}%`, money(c.sgst)) : '') +
      (c.tax_type === 'igst' ? line(`IGST ${c.gst_rate}%`, money(c.igst)) : '') +
      line('Total', money(c.total), 'grand') +
      `<p class="muted small">${c.tax_type === 'igst' ? 'Inter-state supply → IGST' : c.tax_type === 'none' ? 'No GST applied' : 'Intra-state supply → CGST + SGST'}</p>`;
    root.querySelectorAll('#items tr').forEach((tr, i) => {
      const it = st.items[i];
      tr.querySelector('.amt').textContent = money(round2((Number(it.quantity) || 0) * (Number(it.rate) || 0)));
    });
  };
  const drawItems = () => {
    $('#items').innerHTML = st.items.map((it, i) => `
      <tr data-i="${i}">
        <td><input data-k="description" value="${esc(it.description)}" placeholder="e.g. Website design & development" aria-label="Description"></td>
        <td><input data-k="hsn_sac" value="${esc(it.hsn_sac)}" placeholder="998314" aria-label="HSN/SAC" class="w-sm"></td>
        <td><input data-k="quantity" type="number" step="0.01" min="0" value="${esc(it.quantity)}" class="r w-xs" inputmode="decimal" aria-label="Quantity"></td>
        <td><input data-k="rate" type="number" step="0.01" min="0" value="${esc(it.rate)}" class="r w-sm" inputmode="decimal" placeholder="0.00" aria-label="Rate"></td>
        <td class="r amt"></td>
        <td class="r"><button class="icon-btn" data-del aria-label="Remove line" ${st.items.length === 1 ? 'disabled' : ''}><i class="fas fa-trash"></i></button></td>
      </tr>`).join('');
    root.querySelectorAll('#items tr').forEach((tr) => {
      const i = Number(tr.dataset.i);
      tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => { st.items[i][inp.dataset.k] = inp.value; drawTotals(); }));
      tr.querySelector('[data-del]').addEventListener('click', () => { st.items.splice(i, 1); drawItems(); });
    });
    drawTotals();
  };
  drawItems();

  $('#addItem').addEventListener('click', () => { st.items.push({ description: '', hsn_sac: st.items.at(-1)?.hsn_sac || '', quantity: '1', rate: '' }); drawItems(); root.querySelector('#items tr:last-child input')?.focus(); });
  $('#client').addEventListener('change', (e) => { st.client_id = e.target.value; drawTotals(); });
  $('#product').addEventListener('change', (e) => {
    st.product_id = e.target.value;
    const p = products.find((x) => String(x.id) === st.product_id);
    if (p?.client_id && !st.client_id) { st.client_id = String(p.client_id); $('#client').value = st.client_id; drawTotals(); }
  });
  $('#issue').addEventListener('change', (e) => { st.issue_date = e.target.value; });
  $('#due').addEventListener('change', (e) => { st.end_date = e.target.value; });
  $('#gst').addEventListener('change', (e) => { st.gst_rate = e.target.value; drawTotals(); });
  $('#disc').addEventListener('input', (e) => { st.discount = e.target.value; drawTotals(); });
  $('#nogst').addEventListener('change', (e) => { st.no_gst = e.target.checked; $('#gst').disabled = st.no_gst; drawTotals(); });
  $('#gst').disabled = st.no_gst;
  $('#notes').addEventListener('input', (e) => { st.notes = e.target.value; });

  const save = async (btn, markSent) => {
    if (!st.client_id) { toast('Select a client.', 'err'); $('#client').focus(); return; }
    if (!calc().items.length) { toast('Add at least one line item with a description.', 'err'); return; }
    const body = {
      client_id: st.client_id, product_id: st.product_id || null, issue_date: st.issue_date, [dateKey]: st.end_date || null,
      gst_rate: st.no_gst ? 0 : st.gst_rate, tax_mode: st.no_gst ? 'none' : 'auto', discount: st.discount || 0,
      notes: st.notes, items: st.items,
    };
    btn.disabled = true;
    try {
      if (cur) {
        await api.put(res, cur.id, body);
        if (markSent && cur.status === 'draft') await api.put(res, cur.id, { status: 'sent' });
        toast(`${isQuote ? 'Quotation' : 'Invoice'} saved.`);
        location.hash = `${base}/${cur.id}`;
      } else {
        const r = await api.post(res, { ...body, status: markSent ? 'sent' : 'draft' });
        const created = isQuote ? r.quote : r.invoice;
        let msg = r.message;
        if ($('#emailNow')?.checked) {
          try { msg += ' ' + (await api.post(res, {}, { action: 'email', id: created.id })).message; } catch (e) { msg += ' Email not sent: ' + e.message; }
        }
        toast(msg);
        location.hash = `${base}/${created.id}`;
      }
    } catch (err) { toastErr(err); btn.disabled = false; }
  };
  $('#saveDraft')?.addEventListener('click', (e) => save(e.currentTarget, false));
  $('#saveSend').addEventListener('click', (e) => save(e.currentTarget, true));
}

export const invoiceEditor = (root, params, query, alive) => docEditor(root, params, query, alive, 'invoice');

// ---------------------------------------------------------------- detail
export async function invoiceDetail(root, [id], _q, alive) {
  const { invoice: inv, items, payments, settings: s, portal_url } = await api.get('invoices', { id });
  if (!alive()) return;
  const c = inv.erp_clients || {};
  const balance = round2(Number(inv.total) - Number(inv.amount_paid));
  const refresh = () => dispatchEvent(new Event('erp:refresh'));
  const editable = canEdit('invoices') && !['paid', 'cancelled'].includes(inv.status);
  const open = ['sent', 'partially-paid'].includes(inv.status);
  const waText = `Hi ${c.name}, invoice ${inv.invoice_no} from ${s.company_name} for ${money(inv.total)}${balance > 0 && open ? ` (${money(balance)} due${inv.due_date ? ' by ' + fdate(inv.due_date) : ''})` : ''}.` +
    `${c.email ? ` View it in your client portal: ${portal_url}` : ''}${s.upi_id ? ` UPI: ${s.upi_id}` : ''}`;

  root.innerHTML = `
    <div class="page-head no-print">
      <div><h1>${esc(inv.invoice_no)} ${badge(inv.effective_status)}</h1><p>${esc(c.company || c.name)} · ${money(inv.total)}${balance > 0 && inv.status !== 'cancelled' ? ` · <b class="t-red">${money(balance)} due</b>` : ''}
        ${inv.sent_at ? ` · <span class="muted">emailed ${fdate(inv.sent_at.slice(0, 10))}</span>` : ''}${inv.last_reminded_at ? ` · <span class="muted">reminded ${fdate(inv.last_reminded_at.slice(0, 10))}</span>` : ''}</p></div>
      <div class="page-actions">
        <a class="btn btn-ghost" href="#/invoices" aria-label="Back"><i class="fas fa-arrow-left"></i></a>
        ${editable ? `<a class="btn btn-ghost" href="#/invoices/${inv.id}/edit"><i class="fas fa-pen"></i> Edit</a>` : ''}
        ${canEdit('invoices') && inv.status === 'draft' ? '<button class="btn btn-ghost" data-status="sent"><i class="fas fa-check"></i> Mark sent</button>' : ''}
        ${canEdit('invoices') && inv.status !== 'cancelled' ? `<button class="btn btn-ghost" id="email"><i class="fas fa-envelope"></i> Email</button>` : ''}
        ${c.phone && inv.status !== 'cancelled' ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="${esc(waLink(c.phone, waText))}"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
        ${canEdit('payments') && open ? '<button class="btn btn-primary" id="pay"><i class="fas fa-indian-rupee-sign"></i> Record payment</button>' : ''}
        <button class="btn btn-ghost" onclick="window.print()"><i class="fas fa-print"></i> Print / PDF</button>
        <div class="more">
          <button class="icon-btn" id="moreBtn" aria-label="More actions"><i class="fas fa-ellipsis-vertical"></i></button>
          <div class="more-menu" id="moreMenu">
            ${canEdit('invoices') && open && balance > 0 ? '<button id="remind"><i class="fas fa-bell"></i> Send payment reminder</button>' : ''}
            ${canEdit('invoices') && inv.status === 'cancelled' ? '<button data-status="draft"><i class="fas fa-rotate-left"></i> Re-open as draft</button>' : ''}
            ${canEdit('invoices') && !['cancelled', 'paid'].includes(inv.status) && Number(inv.amount_paid) === 0 ? '<button data-status="cancelled"><i class="fas fa-ban"></i> Cancel invoice</button>' : ''}
            ${canEdit('invoices') && Number(inv.amount_paid) === 0 ? '<button id="delInv" class="danger"><i class="fas fa-trash"></i> Delete</button>' : ''}
          </div>
        </div>
      </div>
    </div>
    ${!c.email && inv.status !== 'cancelled' ? '<div class="alert alert-warn no-print"><i class="fas fa-circle-info"></i><div>This client has no email address, so the invoice can\'t be emailed. <a href="#/clients/' + c.id + '">Add an email →</a></div></div>' : ''}
    ${salesDoc('invoice', inv, items, s)}
    <section class="panel no-print">
      <div class="panel-head"><h2>Payments</h2></div>
      ${payments.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th class="r">Amount</th><th></th></tr></thead>
        <tbody>${payments.map((p) => `<tr><td>${fdate(p.paid_on)}</td><td>${esc(p.mode || '—')}</td><td>${esc(p.reference || '—')}</td><td class="r"><b>${money(p.amount)}</b></td>
          <td class="r">${canEdit('payments') ? `<button class="icon-btn" data-delpay="${p.id}" aria-label="Remove payment"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>` : `<p class="muted">${inv.status === 'draft' ? 'Mark the invoice as sent to start recording payments.' : 'No payments recorded yet.'}</p>`}
    </section>`;

  const $ = (sel) => root.querySelector(sel);
  $('#moreBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#moreMenu').classList.toggle('open'); });
  document.addEventListener('click', () => $('#moreMenu')?.classList.remove('open'), { once: true });
  if (!$('#moreMenu').children.length) $('#moreBtn').parentElement.remove();

  const act = async (btn, fn) => { if (btn) btn.disabled = true; try { const r = await fn(); toast(r.message); refresh(); } catch (err) { toastErr(err); if (btn) btn.disabled = false; } };
  root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    const st = b.dataset.status;
    if (st === 'cancelled' && !confirm('Cancel this invoice? It will be kept for records but excluded from totals.')) return;
    act(b, () => api.put('invoices', inv.id, { status: st }));
  }));
  $('#email')?.addEventListener('click', (e) => {
    if (!c.email) { toast('Add an email address for this client first.', 'warn'); return; }
    if (!confirm(`Email ${inv.invoice_no} to ${c.email}?`)) return;
    act(e.currentTarget, () => api.post('invoices', {}, { action: 'email', id: inv.id }));
  });
  $('#remind')?.addEventListener('click', (e) => {
    if (!c.email) { toast('Add an email address for this client first.', 'warn'); return; }
    if (!confirm(`Send a payment reminder for ${money(balance)} to ${c.email}?`)) return;
    act(e.currentTarget, () => api.post('invoices', {}, { action: 'remind', id: inv.id }));
  });
  $('#delInv')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${inv.invoice_no} permanently?`)) return;
    try { const r = await api.del('invoices', { id: inv.id }); toast(r.message); location.hash = '#/invoices'; } catch (err) { toastErr(err); }
  });
  $('#pay')?.addEventListener('click', () => formModal({
    title: `Record payment · ${money(balance)} due`, wide: false, submitLabel: 'Save payment',
    fields: [
      { name: 'amount', label: 'Amount received (₹)', type: 'number', step: '0.01', required: true, default: String(balance) },
      { name: 'paid_on', label: 'Received on', type: 'date', required: true, default: ymd(new Date()) },
      { name: 'mode', label: 'Mode', type: 'select', blank: false, default: 'Bank transfer', options: [['Bank transfer', 'Bank transfer'], ['UPI', 'UPI'], ['Cash', 'Cash'], ['Cheque', 'Cheque'], ['Card', 'Card']] },
      { name: 'reference', label: 'Reference / UTR', placeholder: 'Optional' },
    ],
    onSubmit: async (v) => { const r = await api.post('payments', { invoice_id: inv.id, ...v }); toast(r.message); refresh(); },
  }));
  root.querySelectorAll('[data-delpay]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Remove this payment?')) return;
    act(b, () => api.del('payments', { id: b.dataset.delpay }));
  }));
}
