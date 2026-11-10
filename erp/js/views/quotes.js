import { api, esc, money, fdate, badge, pageHead, empty, toast, toastErr, waLink, canEdit } from '../core.js';
import { docEditor } from './invoices.js';
import { salesDoc } from '../docs.js';

const TABS = [['', 'All'], ['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['converted', 'Converted']];

export async function quotesList(root, _p, query, alive) {
  const status = query.status || '';
  const { quotes } = await api.get('quotes', status ? { status } : {});
  if (!alive()) return;
  const accepted = quotes.filter((x) => x.status === 'accepted');
  root.innerHTML = `
    ${pageHead('Quotations', 'Send a quote → client accepts (in the portal or by reply) → convert to an invoice in one click',
      canEdit('quotes') ? '<a class="btn btn-primary" href="#/quotes/new"><i class="fas fa-plus"></i> New quotation</a>' : '')}
    ${accepted.length && !status ? `<div class="alert alert-info"><i class="fas fa-circle-check"></i><div><b>${accepted.length} accepted quotation(s)</b> waiting to be invoiced. <a href="#/quotes?status=accepted">Review →</a></div></div>` : ''}
    <div class="toolbar"><div class="seg-tabs scroll">${TABS.map(([v, l]) => `<a href="#/quotes${v ? '?status=' + v : ''}" class="${v === status ? 'on' : ''}">${l}</a>`).join('')}</div></div>
    ${quotes.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Quotation</th><th>Client</th><th>Product</th><th>Date</th><th>Valid until</th><th class="r">Total</th><th>Status</th></tr></thead>
      <tbody>${quotes.map((x) => `<tr class="click" data-href="#/quotes/${x.id}">
        <td><b>${esc(x.quote_no)}</b></td><td>${esc(x.erp_clients?.company || x.erp_clients?.name || '—')}</td><td>${esc(x.erp_products?.name || '—')}</td>
        <td>${fdate(x.issue_date)}</td><td>${fdate(x.valid_until)}</td><td class="r">${money(x.total)}</td>
        <td>${x.expired ? badge('overdue', 'expired') : badge(x.status === 'converted' ? 'paid' : x.status === 'accepted' ? 'active' : x.status === 'rejected' ? 'absent' : x.status, x.status)}</td></tr>`).join('')}</tbody>
    </table></div>` : empty('fa-file-signature', 'No quotations yet.', canEdit('quotes') ? '<a class="btn btn-primary" href="#/quotes/new">Create quotation</a>' : '')}`;
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
}

export const quoteEditor = (root, params, query, alive) => docEditor(root, params, query, alive, 'quote');

export async function quoteDetail(root, [id], _q, alive) {
  const { quote: qt, items, settings: s } = await api.get('quotes', { id });
  if (!alive()) return;
  const c = qt.erp_clients || {};
  const can = canEdit('quotes');
  const refresh = () => dispatchEvent(new Event('erp:refresh'));
  const act = async (btn, fn, after) => { btn.disabled = true; try { const r = await fn(); toast(r.message); after ? after(r) : refresh(); } catch (err) { toastErr(err); btn.disabled = false; } };
  const statusBadge = qt.expired ? badge('overdue', 'expired') : badge(qt.status === 'converted' ? 'paid' : qt.status === 'accepted' ? 'active' : qt.status === 'rejected' ? 'absent' : qt.status, qt.status);

  root.innerHTML = `
    <div class="page-head no-print">
      <div><h1>${esc(qt.quote_no)} ${statusBadge}</h1><p>${esc(c.company || c.name)} · ${money(qt.total)}${qt.erp_invoices ? ` · invoiced as <a class="link" href="#/invoices/${qt.erp_invoices.id}">${esc(qt.erp_invoices.invoice_no)}</a>` : ''}</p></div>
      <div class="page-actions">
        <a class="btn btn-ghost" href="#/quotes" aria-label="Back"><i class="fas fa-arrow-left"></i></a>
        ${can && qt.status !== 'converted' ? `<a class="btn btn-ghost" href="#/quotes/${qt.id}/edit"><i class="fas fa-pen"></i> Edit</a>` : ''}
        ${can && qt.status !== 'converted' ? '<button class="btn btn-ghost" id="email"><i class="fas fa-envelope"></i> Email</button>' : ''}
        ${c.phone ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="${esc(waLink(c.phone, `Hi ${c.name}, here is our quotation ${qt.quote_no} for ${money(qt.total)}. Please let us know if you'd like to go ahead.`))}"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
        ${can && ['sent', 'draft'].includes(qt.status) ? '<button class="btn btn-ghost" data-status="accepted"><i class="fas fa-check"></i> Mark accepted</button>' : ''}
        ${can && qt.status === 'sent' ? '<button class="btn btn-ghost" data-status="rejected"><i class="fas fa-xmark"></i> Rejected</button>' : ''}
        ${can && ['accepted', 'sent'].includes(qt.status) && canEdit('invoices') ? '<button class="btn btn-primary" id="convert"><i class="fas fa-file-invoice"></i> Convert to invoice</button>' : ''}
        <button class="btn btn-ghost" onclick="window.print()"><i class="fas fa-print"></i> Print / PDF</button>
        ${can && qt.status !== 'converted' ? '<button class="btn btn-ghost danger" id="del" aria-label="Delete"><i class="fas fa-trash"></i></button>' : ''}
      </div>
    </div>
    ${salesDoc('quote', qt, items, s)}`;

  root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => act(b, () => api.put('quotes', qt.id, { status: b.dataset.status }))));
  root.querySelector('#email')?.addEventListener('click', (e) => {
    if (!c.email) { toast('Add an email address for this client first.', 'warn'); return; }
    if (confirm(`Email ${qt.quote_no} to ${c.email}?`)) act(e.currentTarget, () => api.post('quotes', {}, { action: 'email', id: qt.id }));
  });
  root.querySelector('#convert')?.addEventListener('click', (e) => {
    if (!confirm('Create a draft invoice from this quotation?')) return;
    act(e.currentTarget, () => api.post('quotes', {}, { action: 'convert', id: qt.id }), (r) => { location.hash = '#/invoices/' + r.invoice.id; });
  });
  root.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${qt.quote_no}?`)) return;
    try { const r = await api.del('quotes', { id: qt.id }); toast(r.message); location.hash = '#/quotes'; } catch (err) { toastErr(err); }
  });
}
