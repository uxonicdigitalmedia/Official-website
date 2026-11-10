// Client portal (/erp/client): invoices, quotations, project progress
import { api, Auth, esc, money, fdate, badge, toast, toastErr, spinner, errorView } from './core.js';
import { renderLogin } from './login.js';
import { salesDoc } from './docs.js';

Auth.use('client');
const root = document.getElementById('root');
let tab = 'invoices';

function shell(name, body) {
  return `
    <header class="portal-top">
      <div class="auth-brand"><span class="brand-chip"><img src="/images/nav-logo-sm.png" alt=""></span><div><b>UXONIC</b><small>Client portal</small></div></div>
      <div class="portal-user"><span class="muted small hide-sm">${esc(name)}</span><button class="icon-btn" id="logout" aria-label="Sign out" title="Sign out"><i class="fas fa-right-from-bracket"></i></button></div>
    </header>
    <div class="portal-body">${body}</div>`;
}
const quoteBadge = (q) => (q.status === 'sent' && q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)
  ? badge('overdue', 'expired')
  : badge({ sent: 'sent', accepted: 'active', rejected: 'absent', converted: 'paid' }[q.status] || q.status, q.status === 'sent' ? 'awaiting your reply' : q.status));

async function home() {
  root.innerHTML = spinner();
  const d = await api.get('portal');
  const co = d.company;
  const pending = d.quotes.filter((q) => q.status === 'sent').length;
  root.innerHTML = shell(d.client.company || d.client.name, `
    <section class="hello"><h1>Hello, ${esc(d.client.name.split(' ')[0])}</h1><p class="muted">${esc(d.client.company || '')}</p></section>
    <div class="stats stats-portal">
      <div class="stat"><span class="stat-label">Balance due</span><span class="stat-val ${d.balance_due > 0 ? 't-red' : 't-green'}">${money(d.balance_due)}</span>
        ${d.balance_due > 0 && (co.bank_account || co.upi_id) ? `<span class="stat-sub">Pay to ${[co.bank_name, co.bank_account && 'A/c ' + co.bank_account, co.bank_ifsc && 'IFSC ' + co.bank_ifsc, co.upi_id && 'UPI ' + co.upi_id].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div>
      <div class="stat"><span class="stat-label">Invoices</span><span class="stat-val">${d.invoices.length}</span></div>
      <div class="stat"><span class="stat-label">Quotations waiting</span><span class="stat-val">${pending}</span></div>
    </div>
    <div class="seg-tabs portal-tabs">${[['invoices', 'Invoices'], ['quotes', `Quotations${pending ? ` (${pending})` : ''}`], ['projects', 'Projects']].map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <section class="panel" id="tabBody"></section>
    <p class="muted small center">Questions? Email <a class="link" href="mailto:${esc(co.email)}">${esc(co.email)}</a>${co.phone ? ` or call ${esc(co.phone)}` : ''}.</p>`);

  const body = root.querySelector('#tabBody');
  const draw = () => {
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'invoices') {
      body.innerHTML = d.invoices.length ? `<ul class="list doc-list">${d.invoices.map((i) => `<li><a href="#invoice/${i.id}">
        <span><b>${esc(i.invoice_no)}</b><small class="block muted">${fdate(i.issue_date)}${i.due_date ? ' · due ' + fdate(i.due_date) : ''}</small></span>
        <span class="r"><b>${money(i.total)}</b><small class="block">${badge(i.effective_status)}</small></span></a></li>`).join('')}</ul>` : '<p class="muted">No invoices yet.</p>';
    } else if (tab === 'quotes') {
      body.innerHTML = d.quotes.length ? `<ul class="list doc-list">${d.quotes.map((q) => `<li><a href="#quote/${q.id}">
        <span><b>${esc(q.quote_no)}</b><small class="block muted">${fdate(q.issue_date)}${q.valid_until ? ' · valid until ' + fdate(q.valid_until) : ''}</small></span>
        <span class="r"><b>${money(q.total)}</b><small class="block">${quoteBadge(q)}</small></span></a></li>`).join('')}</ul>` : '<p class="muted">No quotations yet.</p>';
    } else {
      body.innerHTML = d.projects.length ? d.projects.map((p) => `<div class="proj-block">
        <div class="panel-head"><h2>${esc(p.name)}</h2>${badge(p.status)}</div>
        ${p.progress.total ? `<div class="meter"><span style="width:${p.progress.pct}%"></span></div><p class="muted small">${p.progress.pct}% complete · ${p.progress.done} of ${p.progress.total} items done</p>` : '<p class="muted small">Planning in progress.</p>'}
        ${p.milestones.length ? `<ul class="milestones">${p.milestones.map((m) => `<li class="${m.status === 'done' ? 'done' : ''}"><i class="fas ${m.status === 'done' ? 'fa-circle-check' : 'fa-flag'}"></i><span>${esc(m.title)}</span>${m.due_date ? `<small class="muted">${fdate(m.due_date)}</small>` : ''}</li>`).join('')}</ul>` : ''}
        ${p.recent_done.length ? `<p class="small mt"><b>Recently completed:</b> ${p.recent_done.map((t) => esc(t.title)).join(', ')}</p>` : ''}
      </div>`).join('') : '<p class="muted">No active projects.</p>';
    }
  };
  draw();
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
  root.querySelector('#logout').addEventListener('click', () => Auth.logout());
}

async function invoice(id) {
  root.innerHTML = spinner();
  const { invoice: inv, items, payments, settings: s } = await api.get('portal-invoice', { id });
  root.innerHTML = shell(inv.erp_clients?.company || inv.erp_clients?.name || '', `
    <div class="page-head no-print"><div><h1>${esc(inv.invoice_no)} ${badge(inv.effective_status)}</h1><p>${money(inv.total)}</p></div>
      <div class="page-actions"><a class="btn btn-ghost" href="#"><i class="fas fa-arrow-left"></i> Back</a><button class="btn btn-primary" onclick="window.print()"><i class="fas fa-download"></i> Download PDF</button></div></div>
    ${salesDoc('invoice', inv, items, s)}
    ${payments.length ? `<section class="panel no-print"><div class="panel-head"><h2>Payments received</h2></div><ul class="list">${payments.map((p) => `<li><span>${fdate(p.paid_on)} · ${esc(p.mode || '')}</span><b>${money(p.amount)}</b></li>`).join('')}</ul></section>` : ''}`);
  root.querySelector('#logout').addEventListener('click', () => Auth.logout());
}

async function quote(id) {
  root.innerHTML = spinner();
  const { quote: q, items, settings: s } = await api.get('portal-quote', { id });
  const canReply = q.status === 'sent' && !q.expired;
  root.innerHTML = shell(q.erp_clients?.company || q.erp_clients?.name || '', `
    <div class="page-head no-print"><div><h1>${esc(q.quote_no)} ${quoteBadge(q)}</h1><p>${money(q.total)}</p></div>
      <div class="page-actions"><a class="btn btn-ghost" href="#"><i class="fas fa-arrow-left"></i> Back</a>
        ${canReply ? '<button class="btn btn-ghost" data-decision="rejected"><i class="fas fa-xmark"></i> Decline</button><button class="btn btn-primary" data-decision="accepted"><i class="fas fa-check"></i> Accept quotation</button>' : ''}
        <button class="btn btn-ghost" onclick="window.print()"><i class="fas fa-download"></i> PDF</button></div></div>
    ${salesDoc('quote', q, items, s)}`);
  root.querySelector('#logout').addEventListener('click', () => Auth.logout());
  root.querySelectorAll('[data-decision]').forEach((b) => b.addEventListener('click', async () => {
    const yes = b.dataset.decision === 'accepted';
    if (!confirm(yes ? `Accept ${q.quote_no} for ${money(q.total)}?` : `Decline ${q.quote_no}?`)) return;
    b.disabled = true;
    try { const r = await api.post('portal-quote', { decision: b.dataset.decision }, { id: q.id }); toast(r.message); quote(id); }
    catch (err) { toastErr(err); b.disabled = false; }
  }));
}

async function route() {
  if (!Auth.token()) {
    renderLogin(root, { kind: 'client', title: 'Client portal', subtitle: 'Use the email address we invoice. We will send you a one-time code.', onSuccess: () => { location.hash = ''; route(); } });
    return;
  }
  const m = location.hash.match(/^#(invoice|quote)\/(\d+)$/);
  try {
    if (m?.[1] === 'invoice') await invoice(m[2]);
    else if (m?.[1] === 'quote') await quote(m[2]);
    else await home();
    window.scrollTo(0, 0);
  } catch (err) { errorView(root, err, route); }
}
window.addEventListener('hashchange', route);
route();
