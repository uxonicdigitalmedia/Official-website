import { api, esc, money, fdate, badge, pageHead, empty, formModal, toast, toastErr } from '../core.js';

// GST state codes (for CGST+SGST vs IGST)
export const STATES = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'],
  ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'],
  ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'],
  ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'],
  ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'], ['97', 'Other territory'], ['96', 'Outside India (export)'],
];
const stateName = (code) => STATES.find(([c]) => c === code)?.[1] || '';

const CLIENT_FIELDS = [
  { name: 'name', label: 'Client / contact name', required: true },
  { name: 'company', label: 'Company' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'gstin', label: 'GSTIN', placeholder: '33ABCDE1234F1Z5', hint: 'Leave empty for unregistered clients' },
  { name: 'state_code', label: 'State (place of supply)', type: 'select', options: STATES, blank: '— Select state —', hint: 'Same state as you → CGST + SGST, else IGST' },
  { name: 'portal_enabled', label: 'Client portal', type: 'select', blank: false, default: 'true', options: [['true', 'Allowed — signs in at /erp/client with this email'], ['false', 'No access']], span: 2 },
  { name: 'address', label: 'Billing address', type: 'textarea', span: 2, rows: 3 },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
];

export function editClient(client, onDone) {
  formModal({
    title: client ? `Edit ${client.name}` : 'Add client',
    fields: CLIENT_FIELDS, values: client ? { ...client, portal_enabled: String(client.portal_enabled !== false) } : { state_code: '33' },
    submitLabel: client ? 'Save changes' : 'Add client',
    onSubmit: async (v) => {
      v.portal_enabled = v.portal_enabled !== 'false';
      v.state = stateName(v.state_code) || null;
      // GSTIN's first two digits are the state code — fill it in if not chosen
      if (!v.state_code && v.gstin && /^\d{2}/.test(v.gstin)) { v.state_code = v.gstin.slice(0, 2); v.state = stateName(v.state_code) || null; }
      if (v.gstin) v.gstin = v.gstin.toUpperCase();
      const r = client ? await api.put('clients', client.id, v) : await api.post('clients', v);
      toast(r.message);
      onDone && onDone(r.client);
    },
  });
}

export async function clientsList(root, _p, _q, alive) {
  const { clients } = await api.get('clients');
  if (!alive()) return;
  let search = '';
  const draw = () => {
    const s = search.toLowerCase();
    const rows = clients.filter((c) => !s || [c.name, c.company, c.email, c.phone, c.gstin].some((x) => String(x || '').toLowerCase().includes(s)));
    const out = clients.reduce((t, c) => t + c.outstanding, 0);
    root.innerHTML = `
      ${pageHead('Clients', `${clients.length} clients · ${money(out)} outstanding`, '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Add client</button>')}
      <div class="toolbar"><label class="search"><i class="fas fa-magnifying-glass"></i><input id="q" placeholder="Search clients…" value="${esc(search)}"></label></div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Contact</th><th>GSTIN</th><th class="r">Invoiced</th><th class="r">Received</th><th class="r">Outstanding</th><th></th></tr></thead>
        <tbody>${rows.map((c) => `
          <tr class="click" data-id="${c.id}">
            <td><b>${esc(c.company || c.name)}</b>${c.company ? `<small class="block muted">${esc(c.name)}</small>` : ''}</td>
            <td>${esc(c.email || '—')}<small class="block muted">${esc(c.phone || '')}</small></td>
            <td>${esc(c.gstin || '—')}<small class="block muted">${esc(c.state || '')}</small></td>
            <td class="r">${money(c.invoiced)}</td><td class="r">${money(c.received)}</td>
            <td class="r ${c.outstanding > 0 ? 't-red' : ''}"><b>${money(c.outstanding)}</b></td>
            <td class="r"><button class="icon-btn" data-edit title="Edit" aria-label="Edit"><i class="fas fa-pen"></i></button></td>
          </tr>`).join('')}</tbody></table></div>`
      : empty('fa-handshake', clients.length ? 'No clients match.' : 'No clients yet. Add a client to start invoicing.',
        clients.length ? '' : '<button class="btn btn-primary" id="add2">Add first client</button>')}`;
    const q = root.querySelector('#q');
    q.addEventListener('input', () => { search = q.value; const pos = q.selectionStart; draw(); const n = root.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    const add = () => editClient(null, (c) => { clients.push({ ...c, invoiced: 0, received: 0, outstanding: 0 }); draw(); });
    root.querySelector('#add').addEventListener('click', add);
    root.querySelector('#add2')?.addEventListener('click', add);
    root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (ev) => {
      const c = clients.find((x) => String(x.id) === tr.dataset.id);
      if (ev.target.closest('[data-edit]')) { editClient(c, (u) => { Object.assign(c, u); draw(); }); return; }
      location.hash = '#/clients/' + c.id;
    }));
  };
  draw();
}

export async function clientDetail(root, [id], _q, alive) {
  const d = await api.get('clients', { id });
  if (!alive()) return;
  const c = d.client;
  root.innerHTML = `
    ${pageHead(c.company || c.name, [c.company ? esc(c.name) : '', esc(c.email || ''), esc(c.phone || '')].filter(Boolean).join(' · '),
      `<a class="btn btn-ghost" href="#/clients"><i class="fas fa-arrow-left"></i> Back</a>
       <button class="btn btn-ghost danger" id="del"><i class="fas fa-trash"></i></button>
       <button class="btn btn-ghost" id="edit"><i class="fas fa-pen"></i> Edit</button>
       <a class="btn btn-ghost" href="#/quotes/new?client=${c.id}"><i class="fas fa-file-signature"></i> Quotation</a>
       <a class="btn btn-primary" href="#/invoices/new?client=${c.id}"><i class="fas fa-plus"></i> New invoice</a>`)}
    ${c.email && c.portal_enabled !== false ? `<div class="alert alert-info"><i class="fas fa-globe"></i><div>Client portal: <b>${esc(c.email)}</b> can sign in at <b>${esc(location.origin)}/erp/client</b> to see invoices, accept quotations and track project progress.</div></div>` : ''}
    <div class="stats stats-4">
      <div class="stat"><span class="stat-label">Invoiced</span><span class="stat-val">${money(d.money.invoiced)}</span></div>
      <div class="stat"><span class="stat-label">Received</span><span class="stat-val">${money(d.money.received)}</span></div>
      <div class="stat"><span class="stat-label">Outstanding</span><span class="stat-val ${d.money.outstanding > 0 ? 't-red' : ''}">${money(d.money.outstanding)}</span></div>
      <div class="stat"><span class="stat-label">GSTIN</span><span class="stat-val sm">${esc(c.gstin || 'Unregistered')}</span><span class="stat-sub">${esc(c.state || '')}</span></div>
    </div>
    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Invoices</h2></div>
        ${d.invoices.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Invoice</th><th>Date</th><th class="r">Total</th><th>Status</th></tr></thead>
          <tbody>${d.invoices.map((i) => `<tr class="click" data-href="#/invoices/${i.id}"><td><b>${esc(i.invoice_no)}</b></td><td>${fdate(i.issue_date)}</td><td class="r">${money(i.total)}</td><td>${badge(i.effective_status)}</td></tr>`).join('')}</tbody>
        </table></div>` : empty('fa-file-invoice', 'No invoices for this client yet.')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Projects</h2><a class="link" href="#/products">Products <i class="fas fa-arrow-right"></i></a></div>
        ${d.products.length ? `<ul class="list">${d.products.map((p) => `<li><a href="#/products/${p.id}"><b>${esc(p.name)}</b> ${badge(p.status)}</a></li>`).join('')}</ul>`
          : empty('fa-cubes', 'No projects linked. Create a product with kind "Client project" and pick this client.')}
        ${d.quotes.length ? `<div class="panel-head mt"><h2>Quotations</h2></div><ul class="list">${d.quotes.map((x) => `<li><a href="#/quotes/${x.id}"><span><b>${esc(x.quote_no)}</b> · ${money(x.total)}</span>${badge(x.status === 'accepted' ? 'active' : x.status === 'converted' ? 'paid' : x.status === 'rejected' ? 'absent' : x.status, x.status)}</a></li>`).join('')}</ul>` : ''}
        ${c.address ? `<div class="panel-head mt"><h2>Billing address</h2></div><p class="pre">${esc(c.address)}</p>` : ''}
      </section>
    </div>`;
  root.querySelector('#edit').addEventListener('click', () => editClient(c, () => dispatchEvent(new Event('erp:refresh'))));
  root.querySelector('#del').addEventListener('click', async () => {
    if (!confirm(`Delete client ${c.name}? Clients with invoices cannot be deleted.`)) return;
    try { const r = await api.del('clients', { id: c.id }); toast(r.message); location.hash = '#/clients'; } catch (err) { toastErr(err); }
  });
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
}
