import { api, esc, money, fdate, pageHead, empty, formModal, toast, toastErr, canEdit, waLink, downloadCsv } from '../core.js';

export const STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['proposal', 'Proposal sent'], ['negotiation', 'Negotiation'], ['won', 'Won'], ['lost', 'Lost']];
const OPEN = ['new', 'contacted', 'proposal', 'negotiation'];
const STAGE = Object.fromEntries(STAGES);
const STAGE_BADGE = { new: 'badge-blue', contacted: 'badge-violet', proposal: 'badge-amber', negotiation: 'badge-amber', won: 'badge-green', lost: 'badge-red' };
const SOURCES = [['website', 'Website'], ['whatsapp', 'WhatsApp'], ['call', 'Phone call'], ['referral', 'Referral'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['google', 'Google'], ['walk-in', 'Walk-in'], ['other', 'Other']];
const SOURCE = Object.fromEntries(SOURCES);
const SERVICES = ['Website', 'Mobile app', 'Custom software / ERP', 'E-commerce', 'UXONIC Books', 'SEO / Digital marketing', 'Branding / Design', 'Maintenance'];
const PRI = { high: 'badge-red', medium: 'badge-amber', low: 'badge-grey' };
const ACT_ICON = { note: 'fa-note-sticky', call: 'fa-phone', whatsapp: 'fa-whatsapp fab', email: 'fa-envelope', meeting: 'fa-people-group', status: 'fa-arrow-right-arrow-left' };

const stageBadge = (s) => `<span class="badge ${STAGE_BADGE[s] || 'badge-grey'}">${esc(STAGE[s] || s)}</span>`;
const isOpen = (l) => OPEN.includes(l.status);
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const refresh = () => dispatchEvent(new Event('erp:refresh'));

function followUp(l, today) {
  if (!l.next_follow_up || !isOpen(l)) return '';
  const cls = l.next_follow_up < today ? 't-red' : l.next_follow_up === today ? 't-amber' : 'muted';
  const label = l.next_follow_up < today ? `Overdue · ${fdate(l.next_follow_up)}` : l.next_follow_up === today ? 'Follow up today' : fdate(l.next_follow_up);
  return `<span class="${cls}"><i class="fas fa-bell"></i> ${label}</span>`;
}

export function leadForm(lead, { employees = [], onSaved, defaults = {} } = {}) {
  formModal({
    title: lead ? `Edit ${lead.name}` : 'Add lead', submitLabel: lead ? 'Save changes' : 'Add lead',
    values: lead || { status: 'new', priority: 'medium', source: 'call', ...defaults },
    fields: [
      { name: 'name', label: 'Contact name', required: true },
      { name: 'company', label: 'Business / company' },
      { name: 'phone', label: 'Phone / WhatsApp', type: 'tel', placeholder: '98765 43210' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'city', label: 'City', placeholder: 'Karur' },
      { name: 'source', label: 'Lead source', type: 'select', blank: false, options: SOURCES },
      { name: 'service', label: 'Looking for', type: 'select', blank: '— Select —', options: [...new Set([...SERVICES, ...(lead?.service && !SERVICES.includes(lead.service) ? [lead.service] : [])])].map((s) => [s, s]) },
      { name: 'value', label: 'Expected deal value (₹)', type: 'number', step: '1', placeholder: '25000' },
      { name: 'status', label: 'Stage', type: 'select', blank: false, options: STAGES },
      { name: 'priority', label: 'Priority', type: 'select', blank: false, options: [['high', 'Hot'], ['medium', 'Warm'], ['low', 'Cold']] },
      { name: 'owner_id', label: 'Handled by', type: 'select', blank: '— Me / unassigned —', options: employees.filter((e) => e.status === 'active').map((e) => [e.id, e.full_name]) },
      { name: 'next_follow_up', label: 'Next follow-up', type: 'date' },
      { name: 'notes', label: 'Requirement / notes', type: 'textarea', span: 2, rows: 3 },
    ],
    onSubmit: async (v) => {
      const r = lead ? await api.put('leads', lead.id, v) : await api.post('leads', v);
      toast(r.message); onSaved && onSaved(r.lead);
    },
  });
}

async function setStage(lead, status, after) {
  const body = { status };
  if (status === 'lost') {
    const reason = prompt('Why was this lead lost? (price, went with someone else, no response…)', lead.lost_reason || '');
    if (reason === null) return false;
    body.lost_reason = reason || null;
  }
  try { const r = await api.put('leads', lead.id, body); toast(r.message); after && after(r.lead); return true; }
  catch (err) { toastErr(err); return false; }
}

function leadCard(l, today, can) {
  return `<article class="tcard ${l.next_follow_up && l.next_follow_up < today && isOpen(l) ? 'late' : ''}" draggable="${can}" data-id="${l.id}">
    <div class="tcard-top"><span class="badge ${PRI[l.priority]}">${{ high: 'Hot', medium: 'Warm', low: 'Cold' }[l.priority]}</span>${l.service ? `<small class="muted">${esc(l.service)}</small>` : ''}</div>
    <b>${esc(l.company || l.name)}</b>
    ${l.company ? `<small class="muted">${esc(l.name)}</small>` : ''}
    <div class="tcard-foot"><span>${l.value ? `<b>${money(l.value)}</b>` : `<span class="muted">${esc(SOURCE[l.source] || '')}</span>`}</span>${followUp(l, today)}</div>
    ${l.phone ? `<div class="lead-quick"><a href="${telHref(l.phone)}" data-stop title="Call" aria-label="Call"><i class="fas fa-phone"></i></a><a href="${waLink(l.phone, `Hi ${l.name}, this is UXONIC Digital Solutions.`)}" target="_blank" rel="noopener" data-stop title="WhatsApp" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a></div>` : ''}
    ${can ? `<select class="tmove" aria-label="Move lead">${STAGES.map(([v, t]) => `<option value="${v}" ${v === l.status ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
  </article>`;
}

export async function leadsView(root, _p, query, alive) {
  const [{ leads, today, pending_enquiries: pending }, { employees }] = await Promise.all([api.get('leads'), api.get('employees').catch(() => ({ employees: [] }))]);
  if (!alive()) return;
  const can = canEdit('leads');
  const tab = ['board', 'followups', 'list'].includes(query.tab) ? query.tab : 'board';
  let search = '', owner = '', source = '', stage = '';

  const open = leads.filter(isOpen);
  const due = open.filter((l) => l.next_follow_up && l.next_follow_up <= today);
  const monthStart = today.slice(0, 7) + '-01';
  const wonMonth = leads.filter((l) => l.status === 'won' && (l.closed_on || '') >= monthStart);
  const closed = leads.filter((l) => !isOpen(l));
  const winRate = closed.length ? Math.round(100 * closed.filter((l) => l.status === 'won').length / closed.length) : null;

  const matches = (l) => {
    const s = search.toLowerCase();
    return (!s || [l.name, l.company, l.phone, l.email, l.city, l.service, l.notes].some((x) => String(x || '').toLowerCase().includes(s)))
      && (!owner || String(l.owner_id || '') === owner) && (!source || l.source === source) && (!stage || l.status === stage);
  };

  const shell = () => {
    root.innerHTML = `
      ${pageHead('Leads & CRM', `${open.length} open · ${money(open.reduce((t, l) => t + Number(l.value || 0), 0))} in pipeline${due.length ? ` · <span class="t-red">${due.length} follow-up${due.length === 1 ? '' : 's'} due</span>` : ''}`,
        `${can && pending ? `<button class="btn btn-ghost" id="import"><i class="fas fa-globe"></i> Import ${pending} website enquir${pending === 1 ? 'y' : 'ies'}</button>` : ''}
         <button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> CSV</button>
         ${can ? '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Add lead</button>' : ''}`)}
      <div class="stats stats-4">
        <div class="stat"><span class="stat-label">Open leads</span><span class="stat-val">${open.length}</span><span class="stat-sub">${leads.filter((l) => l.status === 'new').length} new, not contacted</span></div>
        <div class="stat"><span class="stat-label">Follow-ups due</span><span class="stat-val ${due.length ? 't-red' : ''}">${due.length}</span><span class="stat-sub">today &amp; overdue</span></div>
        <div class="stat"><span class="stat-label">Won this month</span><span class="stat-val">${wonMonth.length}</span><span class="stat-sub">${money(wonMonth.reduce((t, l) => t + Number(l.value || 0), 0))}</span></div>
        <div class="stat"><span class="stat-label">Win rate</span><span class="stat-val">${winRate === null ? '—' : winRate + '%'}</span><span class="stat-sub">of closed leads</span></div>
      </div>
      <div class="toolbar">
        <div class="seg-tabs">${[['board', 'Pipeline'], ['followups', `Follow-ups${due.length ? ` (${due.length})` : ''}`], ['list', 'All leads']].map(([k, t]) => `<a href="#/leads?tab=${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div>
        <div class="toolbar-right">
          <label class="search"><i class="fas fa-magnifying-glass"></i><input id="q" placeholder="Search name, phone, city…"></label>
          ${tab === 'list' ? `<select id="fs" class="pill-select" aria-label="Stage"><option value="">All stages</option>${STAGES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>` : ''}
          <select id="fsrc" class="pill-select" aria-label="Source"><option value="">All sources</option>${SOURCES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
          ${employees.length ? `<select id="fo" class="pill-select" aria-label="Handled by"><option value="">Everyone</option>${employees.filter((e) => e.status === 'active').map((e) => `<option value="${e.id}">${esc(e.full_name)}</option>`).join('')}</select>` : ''}
        </div>
      </div>
      <div id="body"></div>`;
    const bind = (sel, fn) => root.querySelector(sel)?.addEventListener('input', (e) => { fn(e.target.value); draw(); });
    bind('#q', (v) => { search = v; }); bind('#fs', (v) => { stage = v; }); bind('#fsrc', (v) => { source = v; }); bind('#fo', (v) => { owner = v; });
    root.querySelector('#add')?.addEventListener('click', () => leadForm(null, { employees, onSaved: (l) => { location.hash = '#/leads/' + l.id; } }));
    root.querySelector('#import')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try { const r = await api.post('leads', {}, { action: 'import' }); toast(r.message); refresh(); } catch (err) { toastErr(err); e.currentTarget.disabled = false; }
    });
    root.querySelector('#csv').addEventListener('click', () => downloadCsv(`uxonic-leads-${today}.csv`, [
      ['Name', 'Company', 'Phone', 'Email', 'City', 'Source', 'Looking for', 'Value', 'Stage', 'Priority', 'Handled by', 'Next follow-up', 'Lost reason', 'Notes', 'Added'],
      ...leads.filter(matches).map((l) => [l.name, l.company, l.phone, l.email, l.city, SOURCE[l.source], l.service, l.value, STAGE[l.status], l.priority, l.erp_employees?.full_name, l.next_follow_up, l.lost_reason, l.notes, String(l.created_at).slice(0, 10)]),
    ]));
    draw();
  };

  const body = () => root.querySelector('#body');
  const open_ = (id) => { location.hash = '#/leads/' + id; };

  function drawBoard(rows) {
    const recentWon = (l) => l.status === 'won' && (l.closed_on || '') >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const cols = [...OPEN, 'won'];
    body().innerHTML = leads.length ? `<div class="board board-5">${cols.map((k) => {
      const list = rows.filter((l) => l.status === k && (k !== 'won' || recentWon(l)));
      const val = list.reduce((t, l) => t + Number(l.value || 0), 0);
      return `<div class="col" data-col="${k}"><div class="col-head"><b>${STAGE[k]}${k === 'won' ? ' <small class="muted">· 30 days</small>' : ''}</b><span>${list.length}${val ? ` · ${money(val)}` : ''}</span></div>
        <div class="col-body">${list.map((l) => leadCard(l, today, can)).join('') || '<p class="col-empty">—</p>'}</div></div>`;
    }).join('')}</div><p class="muted small mt">Drag a card to move it. Lost leads are under <a class="link" href="#/leads?tab=list">All leads</a>.</p>`
      : empty('fa-bullseye', 'No leads yet. Add your first enquiry — from a call, WhatsApp, Instagram or the website.', can ? '<button class="btn btn-primary" id="add2">Add first lead</button>' : '');
    body().querySelector('#add2')?.addEventListener('click', () => root.querySelector('#add').click());
    body().querySelectorAll('.tcard').forEach((card) => {
      const lead = leads.find((l) => String(l.id) === card.dataset.id);
      card.addEventListener('click', (e) => { if (!e.target.closest('[data-stop], .tmove')) open_(lead.id); });
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.querySelector('.tmove')?.addEventListener('change', async (e) => { if (!(await setStage(lead, e.target.value, refresh))) e.target.value = lead.status; });
    });
    if (!can) return;
    body().querySelectorAll('.col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('over');
        const lead = leads.find((l) => String(l.id) === e.dataTransfer.getData('text/plain'));
        if (lead && lead.status !== col.dataset.col) setStage(lead, col.dataset.col, refresh);
      });
    });
  }

  function table(rows, emptyText) {
    if (!rows.length) return empty('fa-bullseye', emptyText);
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>Lead</th><th>Contact</th><th>Looking for</th><th class="r">Value</th><th>Stage</th><th>Follow-up</th><th></th></tr></thead>
      <tbody>${rows.map((l) => `<tr class="click" data-id="${l.id}">
        <td><b>${esc(l.company || l.name)}</b><small class="block muted">${esc([l.company ? l.name : '', l.city, SOURCE[l.source]].filter(Boolean).join(' · '))}</small></td>
        <td>${esc(l.phone || '—')}<small class="block muted">${esc(l.email || '')}</small></td>
        <td>${esc(l.service || '—')}</td>
        <td class="r">${l.value ? money(l.value) : '—'}</td>
        <td>${stageBadge(l.status)}${l.status === 'lost' && l.lost_reason ? `<small class="block muted">${esc(l.lost_reason)}</small>` : ''}</td>
        <td class="nowrap">${followUp(l, today) || '<span class="muted">—</span>'}</td>
        <td class="r nowrap">${l.phone ? `<a class="icon-btn" href="${telHref(l.phone)}" data-stop title="Call" aria-label="Call"><i class="fas fa-phone"></i></a><a class="icon-btn" href="${waLink(l.phone, `Hi ${l.name}, this is UXONIC Digital Solutions.`)}" target="_blank" rel="noopener" data-stop title="WhatsApp" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function draw() {
    const rows = leads.filter(matches);
    if (tab === 'board') drawBoard(rows);
    else if (tab === 'followups') {
      const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const openRows = rows.filter(isOpen).sort((a, b) => String(a.next_follow_up || '9').localeCompare(String(b.next_follow_up || '9')));
      const dueRows = openRows.filter((l) => l.next_follow_up && l.next_follow_up <= today);
      const soon = openRows.filter((l) => l.next_follow_up && l.next_follow_up > today && l.next_follow_up <= week);
      const none = openRows.filter((l) => !l.next_follow_up);
      body().innerHTML = `
        <section class="panel"><div class="panel-head"><h2>Due today &amp; overdue</h2></div>${table(dueRows, 'Nothing due. Nice work!')}</section>
        <section class="panel"><div class="panel-head"><h2>Next 7 days</h2></div>${table(soon, 'No follow-ups planned this week.')}</section>
        ${none.length ? `<section class="panel"><div class="panel-head"><h2>No follow-up date</h2><small class="muted">Open leads that may be forgotten</small></div>${table(none, '')}</section>` : ''}`;
    } else {
      body().innerHTML = table(rows, leads.length ? 'No leads match.' : 'No leads yet.');
    }
    body().querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-stop]')) open_(tr.dataset.id); }));
  }

  shell();
}

export async function leadDetail(root, [id], _q, alive) {
  const [{ lead: l, activities }, { employees }] = await Promise.all([api.get('leads', { id }), api.get('employees').catch(() => ({ employees: [] }))]);
  if (!alive()) return;
  const can = canEdit('leads');
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const client = l.erp_clients;
  const wa = l.phone ? waLink(l.phone, `Hi ${l.name}, this is UXONIC Digital Solutions.`) : '';
  const plusDays = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

  root.innerHTML = `
    ${pageHead(l.company || l.name, `${l.company ? esc(l.name) + ' · ' : ''}${stageBadge(l.status)} ${l.service ? '· ' + esc(l.service) : ''}${l.value ? ' · ' + money(l.value) : ''}`,
      `<a class="btn btn-ghost" href="#/leads"><i class="fas fa-arrow-left"></i> Back</a>
       ${l.phone ? `<a class="btn btn-ghost" href="${telHref(l.phone)}"><i class="fas fa-phone"></i> Call</a><a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
       ${l.email ? `<a class="btn btn-ghost" href="mailto:${esc(l.email)}"><i class="fas fa-envelope"></i> Email</a>` : ''}
       ${can ? `<button class="btn btn-ghost" id="edit"><i class="fas fa-pen"></i> Edit</button><button class="btn btn-ghost danger" id="del" aria-label="Delete lead"><i class="fas fa-trash"></i></button>` : ''}`)}
    ${client ? `<div class="alert alert-info"><i class="fas fa-handshake"></i><div>Converted to client <a href="#/clients/${client.id}">${esc(client.company || client.name)}</a>. <a href="#/quotes/new?client=${client.id}">New quotation</a> · <a href="#/invoices/new?client=${client.id}">New invoice</a></div></div>` : ''}
    ${l.next_follow_up && isOpen(l) && l.next_follow_up <= today ? `<div class="alert alert-warn"><i class="fas fa-bell"></i><div><b>${l.next_follow_up < today ? 'Follow-up overdue' : 'Follow up today'}</b> (${fdate(l.next_follow_up)}). Log the call or message below and set the next date.</div></div>` : ''}
    ${can ? `<div class="stage-bar">${STAGES.map(([v, t]) => `<button class="stage ${v === l.status ? 'on' : ''} stage-${v}" data-stage="${v}">${t}</button>`).join('')}</div>` : ''}
    <div class="grid-2 grid-2-wide">
      <section class="panel">
        <div class="panel-head"><h2>Activity</h2></div>
        ${can ? `<form id="note" class="note-form">
          <div class="seg-tabs" role="radiogroup" aria-label="Type">${[['call', 'fa-phone', 'Call'], ['whatsapp', 'fa-whatsapp fab', 'WhatsApp'], ['meeting', 'fa-people-group', 'Meeting'], ['email', 'fa-envelope', 'Email'], ['note', 'fa-note-sticky', 'Note']].map(([k, ic, t], i) => `<button type="button" data-kind="${k}" class="${i === 0 ? 'on' : ''}"><i class="fas ${ic}"></i> ${t}</button>`).join('')}</div>
          <textarea name="body" rows="3" placeholder="What happened? e.g. Spoke to him, wants a quote for a 5-page website" required></textarea>
          <div class="note-foot">
            <label>Next follow-up <input type="date" name="next" value="${esc(l.next_follow_up || '')}"></label>
            <span class="quick-dates">${[[1, 'Tomorrow'], [3, '+3 days'], [7, '+1 week']].map(([n, t]) => `<button type="button" class="btn btn-sm btn-ghost" data-plus="${n}">${t}</button>`).join('')}</span>
            <button class="btn btn-primary" type="submit">Save</button>
          </div>
        </form>` : ''}
        ${activities.length ? `<ul class="feed">${activities.map((a) => `<li class="feed-${a.kind}"><span class="feed-ic"><i class="fas ${ACT_ICON[a.kind] || 'fa-circle'}"></i></span><div><p class="pre">${esc(a.body)}</p><small class="muted">${esc(a.actor || '')} · ${new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></div></li>`).join('')}</ul>` : empty('fa-comments', 'No activity yet.')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Details</h2></div>
        <div class="kv-grid">
          ${[['Phone', l.phone], ['Email', l.email], ['City', l.city], ['Source', SOURCE[l.source]], ['Looking for', l.service], ['Deal value', l.value ? money(l.value) : ''],
            ['Priority', { high: 'Hot', medium: 'Warm', low: 'Cold' }[l.priority]], ['Handled by', l.erp_employees?.full_name], ['Next follow-up', l.next_follow_up ? fdate(l.next_follow_up) : ''],
            ['Added', fdate(String(l.created_at).slice(0, 10))], ...(l.closed_on ? [[l.status === 'won' ? 'Won on' : 'Closed on', fdate(l.closed_on)]] : []), ...(l.lost_reason ? [['Lost reason', l.lost_reason]] : [])]
            .map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v || '—')}</b></div>`).join('')}
        </div>
        ${l.notes ? `<div class="panel-head mt"><h2>Requirement</h2></div><p class="pre">${esc(l.notes)}</p>` : ''}
        ${can && l.status !== 'lost' ? `<div class="mt"><button class="btn btn-primary block-btn" id="convert"><i class="fas fa-trophy"></i> ${client ? 'Create quotation' : 'Won — make client &amp; quotation'}</button><small class="muted block mt">${client ? '' : 'Adds this lead to Clients (or links an existing client with the same email/phone) and opens a new quotation.'}</small></div>` : ''}
      </section>
    </div>`;

  root.querySelector('#edit')?.addEventListener('click', () => leadForm(l, { employees, onSaved: refresh }));
  root.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm(`Delete lead ${l.name} and its activity log?`)) return;
    try { const r = await api.del('leads', { id: l.id }); toast(r.message); location.hash = '#/leads'; } catch (err) { toastErr(err); }
  });
  root.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.stage !== l.status) setStage(l, b.dataset.stage, refresh); }));
  root.querySelector('#convert')?.addEventListener('click', async (e) => {
    if (client) { location.hash = `#/quotes/new?client=${client.id}`; return; }
    if (!confirm(`Mark ${l.name} as Won and add as a client?`)) return;
    e.currentTarget.disabled = true;
    try { const r = await api.post('leads', {}, { action: 'convert', id: l.id }); toast(r.message); location.hash = `#/quotes/new?client=${r.client.id}`; }
    catch (err) { toastErr(err); e.currentTarget.disabled = false; }
  });

  const form = root.querySelector('#note');
  if (form) {
    let kind = 'call';
    form.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.kind; form.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    form.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => { form.next.value = plusDays(Number(b.dataset.plus)); }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = form.body.value.trim();
      if (!text) { toast('Write what happened first.', 'err'); form.body.focus(); return; }
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const r = await api.post('leads', { kind, body: text, next_follow_up: form.next.value || null }, { action: 'note', id: l.id });
        toast(r.message); refresh();
      } catch (err) { toastErr(err); btn.disabled = false; }
    });
  }
}
