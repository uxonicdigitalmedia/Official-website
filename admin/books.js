'use strict';
/* ================================================================
   Admin → UXONIC Books (owner's panel)
   Same OTP login as the rest of the admin. Every call goes to
   /api/admin/books, which calls the UXONIC Books database's platform_*
   functions with a private server key (never sent to the browser).
   ================================================================ */
import { initLayout, API, e, toast } from '/admin/admin.js';

initLayout('books');
const $ = (id) => document.getElementById(id);
const PAGE = 25;

// ── formatting ───────────────────────────────────────────────────
const TZ = 'Asia/Kolkata';
const rupees = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const rupeesExact = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const date = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—');
const dayInput = (v) => (v ? new Date(v).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
const endOfDay = (d) => (d ? new Date(`${d}T23:59:59+05:30`).toISOString() : null);
const daysFrom = (v) => Math.ceil((new Date(v) - Date.now()) / 864e5);
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
const monthLong = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const STATES = {
  trial: ['In trial', 'st-trial'],
  trial_ended: ['Trial ended', 'st-warn'],
  active: ['Paying', 'st-good'],
  complimentary: ['Free (no end date)', 'st-brand'],
  past_due: ['Payment due', 'st-warn'],
  lapsed: ['Renewal overdue', 'st-bad'],
  cancelled: ['Cancelled', 'st-muted'],
  expired: ['Expired', 'st-bad'],
  halted: ['Halted', 'st-bad'],
  suspended: ['Suspended', 'st-bad'],
  blocked: ['Blocked', 'st-bad'],
};
const stateBadge = (s) => { const [l, c] = STATES[s] || [s, 'st-muted']; return `<span class="st ${c}">${e(l)}</span>`; };
const METHODS = { upi: 'UPI', bank: 'Bank transfer', cash: 'Cash', cheque: 'Cheque', other: 'Other', razorpay: 'Online (Razorpay)' };
const APP_NAMES = { crm: 'CRM', billing: 'Billing', erp: 'ERP', hr: 'HR' };
const FEATURES = {
  tasks: 'Tasks', reminders: 'Reminders', basic_reports: 'Basic reports', quotations: 'Quotations', invoices: 'Invoices',
  expenses: 'Expenses & approvals', team_assignment: 'Team assignment', advanced_reports: 'Advanced reports',
  multi_pipeline: 'Multiple pipelines', advanced_permissions: 'Advanced permissions', export: 'Data export',
  analytics: 'Analytics', priority_support: 'Priority support', custom_branding: 'Custom branding',
};

// ── database calls ───────────────────────────────────────────────
const ERRORS = {
  forbidden: 'The UXONIC Books server key does not match. Check BOOKS_PLATFORM_KEY on the server.',
  payment_in_future: 'The payment date cannot be in the future.',
};
async function rpc(name, args) {
  const r = await API.post('/books', { fn: name, args: args || {} });
  if (!r) throw new Error('Signed out.');
  if (!r.success) {
    const hint = r.hint ? ` (${r.hint})` : '';
    throw new Error(ERRORS[r.code] || (r.code === 'invalid_input' ? `Please check the form${hint}.` : r.message));
  }
  return r.data;
}
const fail = (err) => toast(err.message || String(err), 'error');

// ── modal helpers (admin.js Modal does not support focus return) ─
let lastFocus = null;
function openModal(id) { lastFocus = document.activeElement; $(id).classList.add('open'); document.body.style.overflow = 'hidden'; setTimeout(() => $(id).querySelector('input,select,button:not(.modal-close)')?.focus(), 50); }
function closeModal(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; lastFocus?.focus?.(); }
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach((m) => m.addEventListener('click', (ev) => { if (ev.target === m) closeModal(m.id); }));
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach((m) => closeModal(m.id)); });

// ── connection check ─────────────────────────────────────────────
function showProblem(message) {
  $('bkApp').hidden = true; $('bkGate').hidden = false;
  $('bkGateBody').textContent = message;
}

// ── tabs ─────────────────────────────────────────────────────────
const loaders = {};
const loaded = new Set();
function showTab(name, force = false) {
  if (!loaders[name]) name = 'overview';
  document.querySelectorAll('#bkNav a[data-tab]').forEach((a) => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  const label = document.querySelector(`#bkNav a[data-tab="${name}"]`)?.textContent.trim();
  const sub = document.querySelector('.topbar-subtitle'); if (sub && label) sub.textContent = label;
  if (history.replaceState && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  if (force || !loaded.has(name)) { loaded.add(name); loaders[name]().catch(fail); }
  if (document.getElementById('sidebar')?.classList.contains('open')) {
    document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); document.body.style.overflow = '';
  }
  window.scrollTo(0, 0);
}
const currentTab = () => document.querySelector('#bkNav a[aria-current="page"]')?.dataset.tab || 'overview';
document.querySelectorAll('#bkNav a[data-tab]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); showTab(a.dataset.tab, true); }));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

// ── chart (one series; hover/focus tooltip; table view) ──────────
const tip = $('bkTip');
function barChart(el, rows, { fmt, label }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const peak = rows.reduce((b, r, i) => (r.value > rows[b].value ? i : b), 0);
  const last = rows.length - 1;
  el.innerHTML = `
    <div class="bk-ymax">${max ? e(fmt(max)) : ''}</div>
    <div class="bk-bars" role="list" aria-label="${e(label)}">
      ${rows.map((r, i) => {
        const h = max ? Math.max(2, Math.round((r.value / max) * 150)) : 0;
        const showLabel = r.value > 0 && (i === peak || i === last);
        return `<div class="bk-col${r.value ? '' : ' zero'}" role="listitem" tabindex="0" style="--h:${h}px"
          data-tip="${e(monthLong(r.month))}: ${e(fmt(r.value))}" aria-label="${e(monthLong(r.month))}: ${e(fmt(r.value))}">
          ${showLabel ? `<em>${e(fmt(r.value))}</em>` : ''}<i style="height:${h}px"></i></div>`;
      }).join('')}
    </div>
    <div class="bk-xlabels" aria-hidden="true">${rows.map((r) => `<span>${e(monthLabel(r.month))}</span>`).join('')}</div>
    <details><summary>Show as table</summary>
      <table class="mini"><thead><tr><th>Month</th><th class="num">${e(label)}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${e(monthLong(r.month))}</td><td class="num">${e(fmt(r.value))}</td></tr>`).join('')}</tbody></table>
    </details>`;
  el.querySelectorAll('.bk-col').forEach((c) => {
    const on = () => { const b = c.getBoundingClientRect(); tip.innerHTML = e(c.dataset.tip); tip.style.left = `${b.left + b.width / 2}px`; tip.style.top = `${b.bottom - parseInt(c.style.getPropertyValue('--h') || '0', 10)}px`; tip.hidden = false; };
    const off = () => { tip.hidden = true; };
    c.addEventListener('mouseenter', on); c.addEventListener('focus', on);
    c.addEventListener('mouseleave', off); c.addEventListener('blur', off);
  });
}

// ── OVERVIEW ─────────────────────────────────────────────────────
const stat = (icon, value, label, cls = '', trend = '') =>
  `<div class="stat-card"><div class="stat-card-top"><div class="stat-icon ${cls}"><i class="fas ${icon}"></i></div>${trend ? `<div class="stat-trend">${e(trend)}</div>` : ''}</div><div class="stat-value">${e(value)}</div><div class="stat-label">${e(label)}</div></div>`;
const orgItem = (o, right) => `<li><button class="grow bk-link" data-org="${e(o.id)}"><b>${e(o.name)}</b><small>${e(o.plan_name || '')}</small></button>${right}</li>`;
const list = (items, empty) => (items.length ? `<ul class="bk-list">${items.join('')}</ul>` : `<div class="bk-empty">${e(empty)}</div>`);

loaders.overview = async () => {
  const o = await rpc('platform_overview');
  const st = o.states || {};
  const trial = (st.trial || 0);
  const ended = (st.trial_ended || 0);
  const change = o.revenue.last_month ? Math.round(((o.revenue.this_month - o.revenue.last_month) / o.revenue.last_month) * 100) : null;
  $('ovStats').innerHTML = [
    stat('fa-building', String(o.workspaces), 'Customers (workspaces)', '', `+${o.new_this_month} this month`),
    stat('fa-circle-check', String(o.paying), 'Paying customers', 'green'),
    stat('fa-arrows-rotate', rupees(o.mrr_paise), 'Monthly recurring revenue', 'green', `${rupees(o.mrr_paise * 12)} / year`),
    stat('fa-indian-rupee-sign', rupees(o.revenue.this_month), 'Received this month', 'blue', change === null ? '' : `${change >= 0 ? '+' : ''}${change}% vs last month`),
    stat('fa-calendar', rupees(o.revenue.this_year), 'Received this financial year', ''),
    stat('fa-sack-dollar', rupees(o.revenue.total), 'Received in total', ''),
    stat('fa-hourglass-half', String(trial), 'In free trial', 'blue', ended ? `${ended} trial ended, not paid` : ''),
    stat('fa-users', String(o.users), 'People signed up', ''),
  ].join('');
  barChart($('ovRevenue'), o.months.map((m) => ({ month: m.month, value: Number(m.revenue) })), { fmt: rupees, label: 'Revenue' });
  barChart($('ovSignups'), o.months.map((m) => ({ month: m.month, value: Number(m.signups) })), { fmt: (n) => `${n} new`, label: 'New workspaces' });
  $('ovTrials').innerHTML = list(o.trials_ending.map((x) => orgItem(x, `<span class="st st-trial">${Math.max(0, daysFrom(x.trial_ends_at))} d left</span>`)), 'No trials end this week.');
  $('ovRenewals').innerHTML = list(o.renewals_due.map((x) => orgItem(x, x.state === 'lapsed'
    ? `<span class="st st-bad">Overdue ${date(x.current_period_end)}</span>` : `<span class="st st-warn">${date(x.current_period_end)}</span>`)), 'Nothing due this week.');
  $('ovRecent').innerHTML = list(o.recent.map((x) => orgItem(x, stateBadge(x.state))), 'No workspaces yet.');
  $('ovPlans').innerHTML = o.plans.map((p) => `<tr><td class="bold">${e(p.name)}</td><td>${p.kind === 'suite' ? 'UXONIC Books' : 'Single app'}</td><td class="num">${p.workspaces}</td><td class="num">${p.paying}</td><td class="num">${rupees(p.mrr_paise)}</td></tr>`).join('');
};
document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-org]'); if (b) openOrg(b.dataset.org); });

// ── CUSTOMERS ────────────────────────────────────────────────────
let plansCache = null;
async function plans(force = false) {
  if (!plansCache || force) plansCache = await rpc('platform_plans');
  return plansCache;
}
const cu = { page: 0 };
$('cuState').innerHTML = `<option value="">All statuses</option>${Object.entries(STATES).map(([k, [l]]) => `<option value="${k}">${e(l)}</option>`).join('')}`;
let cuTimer;
$('cuSearch').addEventListener('input', () => { clearTimeout(cuTimer); cuTimer = setTimeout(() => { cu.page = 0; loadCustomers().catch(fail); }, 300); });
$('cuState').addEventListener('change', () => { cu.page = 0; loadCustomers().catch(fail); });
$('cuPlan').addEventListener('change', () => { cu.page = 0; loadCustomers().catch(fail); });

function pager(el, total, page, go) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  el.innerHTML = `<div class="pagination-info">${total ? `${page * PAGE + 1}–${Math.min(total, (page + 1) * PAGE)} of ${total}` : ''}</div>
    <div class="pagination-btns"><button class="page-btn" ${page === 0 ? 'disabled' : ''} data-p="${page - 1}" aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>
    <button class="page-btn" ${page >= pages - 1 ? 'disabled' : ''} data-p="${page + 1}" aria-label="Next page"><i class="fas fa-chevron-right"></i></button></div>`;
  el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.p))));
}

async function loadCustomers() {
  const r = await rpc('platform_orgs', { p_search: $('cuSearch').value || null, p_state: $('cuState').value || null, p_plan: $('cuPlan').value || null, p_limit: PAGE, p_offset: cu.page * PAGE });
  $('cuCount').textContent = `${r.total} ${r.total === 1 ? 'customer' : 'customers'}`;
  $('cuRows').innerHTML = r.rows.length ? r.rows.map((o) => `<tr>
      <td><button class="bk-link" data-org="${e(o.id)}">${e(o.name)}</button><div class="text-xs text-muted">${e(o.phone || o.slug)}</div></td>
      <td><div>${e(o.owner_name || '—')}</div><div class="text-xs text-muted">${e(o.owner_email || '')}</div></td>
      <td>${e(o.plan_name)}${o.cycle === 'yearly' ? ' <span class="text-xs text-muted">yearly</span>' : ''}</td>
      <td>${stateBadge(o.state)}</td>
      <td>${o.state === 'trial' || o.state === 'trial_ended' ? date(o.trial_ends_at) : date(o.current_period_end)}</td>
      <td class="num">${o.members}</td>
      <td class="num">${rupees(o.paid_paise)}</td>
      <td class="muted">${date(o.created_at)}</td></tr>`).join('')
    : '<tr><td colspan="8" class="table-empty">No customers match.</td></tr>';
  pager($('cuPager'), r.total, cu.page, (p) => { cu.page = p; loadCustomers().catch(fail); });
}
loaders.customers = async () => {
  const p = await plans();
  const cur = $('cuPlan').value;
  $('cuPlan').innerHTML = `<option value="">All plans</option>${p.plans.map((x) => `<option value="${e(x.code)}">${e(x.name)}</option>`).join('')}`;
  $('cuPlan').value = cur;
  await loadCustomers();
};

// ── CUSTOMER DETAIL ──────────────────────────────────────────────
async function openOrg(id) {
  $('orgTitle').textContent = 'Loading…'; $('orgSub').textContent = ''; $('orgBody').innerHTML = '';
  openModal('orgModal');
  try {
    const [d, p] = await Promise.all([rpc('platform_org', { p_org: id }), plans()]);
    renderOrg(d, p.plans);
  } catch (err) { closeModal('orgModal'); fail(err); }
}

function renderOrg(d, allPlans) {
  const o = d.org, s = d.subscription, u = d.usage;
  const planOpts = (sel) => allPlans.map((x) => `<option value="${e(x.code)}" ${x.code === sel ? 'selected' : ''}>${e(x.name)}${x.is_active ? '' : ' (hidden)'}</option>`).join('');
  const addr = o.address || {};
  $('orgTitle').textContent = o.name;
  $('orgSub').innerHTML = `${stateBadge(o.state)} &nbsp; ${e(s.plan_name)} · joined ${date(o.created_at)}`;
  const phone = (o.phone || d.owner?.phone || '').replace(/[^0-9]/g, '');
  const wa = phone ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(`Hi, this is UXONIC about your UXONIC Books workspace "${o.name}".`)}` : '';
  $('orgBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-key">Owner</span><span class="detail-val">${e(d.owner?.name || '—')}<br><span class="text-xs text-muted">${e(d.owner?.email || '')}</span></span></div>
      <div class="detail-item"><span class="detail-key">Phone</span><span class="detail-val">${e(o.phone || d.owner?.phone || '—')}</span></div>
      <div class="detail-item"><span class="detail-key">GSTIN</span><span class="detail-val">${e(o.gstin || '—')}</span></div>
      <div class="detail-item"><span class="detail-key">Address</span><span class="detail-val">${e([addr.line1, addr.city, addr.pincode].filter(Boolean).join(', ') || '—')}</span></div>
      <div class="detail-item"><span class="detail-key">Plan</span><span class="detail-val">${e(s.plan_name)} · ${s.cycle === 'yearly' ? 'yearly' : 'monthly'} · ${rupees(s.cycle === 'yearly' ? s.price_yearly_paise : s.price_monthly_paise)}</span></div>
      <div class="detail-item"><span class="detail-key">${s.status === 'trialing' ? 'Trial ends' : 'Paid until'}</span><span class="detail-val">${s.status === 'trialing' ? date(s.trial_ends_at) : (s.current_period_end ? date(s.current_period_end) : 'No end date')}</span></div>
    </div>
    <div class="bk-section"><h3>Usage</h3>
      <div class="bk-kpis">
        <div><b>${d.members.filter((m) => m.status === 'active').length}</b><span>Users</span></div>
        <div><b>${u.contacts + u.leads}</b><span>Leads &amp; contacts</span></div>
        <div><b>${u.invoices}</b><span>Invoices issued</span></div>
        <div><b>${u.products}</b><span>Products</span></div>
        <div><b>${u.employees}</b><span>Staff (HR)</span></div>
      </div>
    </div>
    <div class="bk-section"><h3>Business type &amp; features</h3><div id="orgBusiness"><div class="bk-empty">Loading…</div></div></div>
    <div class="bk-section"><h3>Actions</h3>
      <div class="bk-actions">
        <button class="btn btn-primary btn-sm" data-act="pay"><i class="fas fa-indian-rupee-sign"></i> Record payment</button>
        <button class="btn btn-ghost btn-sm" data-act="edit"><i class="fas fa-pen"></i> Change plan or dates</button>
        ${s.status === 'trialing' ? '<button class="btn btn-ghost btn-sm" data-act="trial7"><i class="fas fa-clock"></i> Extend trial 7 days</button>' : ''}
        ${o.status === 'active' ? '<button class="btn btn-ghost btn-sm" data-act="suspend" title="Read-only: they can sign in and see data but cannot change anything"><i class="fas fa-pause"></i> Suspend</button>' : ''}
        ${o.status === 'suspended' ? '<button class="btn btn-success btn-sm" data-act="reactivate"><i class="fas fa-rotate-left"></i> Reactivate</button>' : ''}
        ${o.status === 'blocked' ? '<button class="btn btn-success btn-sm" data-act="reactivate"><i class="fas fa-unlock"></i> Unblock</button>'
          : '<button class="btn btn-danger btn-sm" data-act="block" title="Nobody in this business can open the workspace"><i class="fas fa-ban"></i> Block</button>'}
        <button class="btn btn-danger btn-sm" data-act="delete"><i class="fas fa-trash"></i> Delete</button>
        ${wa ? `<a class="btn btn-ghost btn-sm" href="${e(wa)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
        ${d.owner?.email ? `<a class="btn btn-ghost btn-sm" href="mailto:${e(d.owner.email)}"><i class="fas fa-envelope"></i> Email</a>` : ''}
      </div>

      <form class="bk-panel" id="payForm" hidden novalidate>
        <div class="bk-row-4">
          <div class="form-group"><label class="form-label" for="pPlan">Plan</label><select class="form-select" id="pPlan">${planOpts(s.plan_code)}</select></div>
          <div class="form-group"><label class="form-label" for="pCycle">Period</label><select class="form-select" id="pCycle"><option value="monthly">1 month</option><option value="yearly" ${s.cycle === 'yearly' ? 'selected' : ''}>1 year</option></select></div>
          <div class="form-group"><label class="form-label" for="pAmount">Amount received (₹)</label><input class="form-input" id="pAmount" type="number" min="1" step="0.01" inputmode="decimal" required/></div>
          <div class="form-group"><label class="form-label" for="pMethod">Paid by</label><select class="form-select" id="pMethod">${['upi', 'bank', 'cash', 'cheque', 'other'].map((m) => `<option value="${m}">${METHODS[m]}</option>`).join('')}</select></div>
        </div>
        <div class="bk-row-3">
          <div class="form-group"><label class="form-label" for="pRef">UPI / bank reference</label><input class="form-input" id="pRef" maxlength="120" placeholder="e.g. UTR number"/></div>
          <div class="form-group"><label class="form-label" for="pDate">Received on</label><input class="form-input" id="pDate" type="date" value="${dayInput(new Date())}" max="${dayInput(new Date())}"/></div>
          <div class="form-group"><label class="form-label" for="pNote">Note</label><input class="form-input" id="pNote" maxlength="500"/></div>
        </div>
        <div class="bk-checks"><label><input type="checkbox" id="pExtend" checked/> Start / extend the paid period (adds 1 month or 1 year after the current paid date)</label></div>
        <div class="bk-checks"><label><input type="checkbox" id="pMail" checked/> Email the invoice (PDF) and a thank-you note to the customer</label></div>
        <p class="bk-err" id="pErr" role="alert"></p>
        <div class="modal-footer"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save payment</button></div>
      </form>

      <form class="bk-panel bk-danger" id="delForm" hidden novalidate>
        <p><b>Delete ${e(o.name)} permanently?</b> Every contact, invoice, product, staff record, payment and file record of this business is deleted. This cannot be undone.</p>
        <div class="form-group"><label class="form-label" for="dName">Type the business name to confirm: <b>${e(o.name)}</b></label><input class="form-input" id="dName" autocomplete="off"/></div>
        <div class="bk-checks"><label><input type="checkbox" id="dLogins" checked/> Also delete the logins of people who have no other workspace (${d.members.length} member${d.members.length === 1 ? '' : 's'})</label></div>
        <p class="bk-err" id="dErr" role="alert"></p>
        <div class="modal-footer"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-danger" type="submit" id="dGo" disabled><i class="fas fa-trash"></i> Delete forever</button></div>
      </form>

      <form class="bk-panel" id="editForm" hidden novalidate>
        <div class="bk-row-3">
          <div class="form-group"><label class="form-label" for="ePlan">Plan</label><select class="form-select" id="ePlan">${planOpts(s.plan_code)}</select></div>
          <div class="form-group"><label class="form-label" for="eStatus">Status</label><select class="form-select" id="eStatus">
            ${[['trialing', 'Free trial'], ['active', 'Active (paid or free)'], ['past_due', 'Payment due'], ['cancelled', 'Cancelled (works till paid date)'], ['expired', 'Expired (read-only)'], ['halted', 'Halted (read-only)']]
              .map(([v, l]) => `<option value="${v}" ${v === s.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label" for="eCycle">Billing</label><select class="form-select" id="eCycle"><option value="monthly">Monthly</option><option value="yearly" ${s.cycle === 'yearly' ? 'selected' : ''}>Yearly</option></select></div>
        </div>
        <div class="bk-row">
          <div class="form-group"><label class="form-label" for="eTrial">Trial ends on</label><input class="form-input" id="eTrial" type="date" value="${dayInput(s.trial_ends_at)}"/></div>
          <div class="form-group"><label class="form-label" for="eEnd">Paid until</label><input class="form-input" id="eEnd" type="date" value="${dayInput(s.current_period_end)}"/>
            <p class="form-hint">Leave empty with status Active for a free account with no end date.</p></div>
        </div>
        <p class="bk-err" id="eErr" role="alert"></p>
        <div class="modal-footer"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></div>
      </form>
    </div>

    <div class="bk-section"><h3>Payments <span class="text-xs text-muted">${rupees(d.payments.filter((x) => x.status === 'captured').reduce((a, x) => a + x.amount_paise, 0))} received</span></h3>
      ${d.payments.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th>Date</th><th>Plan</th><th>Method</th><th>Reference</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>
        ${d.payments.map((x) => `<tr><td>${date(x.paid_at || x.created_at)}</td><td>${e(allPlans.find((p) => p.code === x.plan_code)?.name || x.plan_code || '—')}${x.cycle ? ` · ${x.cycle}` : ''}</td><td>${e(METHODS[x.method] || x.method)}</td><td>${e(x.reference || x.rzp_payment_id || '—')}</td><td class="num">${rupeesExact(x.amount_paise)}</td><td>${x.status === 'captured' ? '<span class="st st-good">Received</span>' : `<span class="st st-muted">${e(x.status)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="bk-empty">No payments yet.</div>'}
    </div>

    <div class="bk-section"><h3>Team</h3>
      <div class="table-wrap"><table class="mini"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>
        ${d.members.map((m) => `<tr><td>${e(m.name || '—')}</td><td>${e(m.email || '')}</td><td style="text-transform:capitalize">${e(m.role)}</td><td>${e(m.status)}</td><td>${date(m.joined_at)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;

  const body = $('orgBody');
  renderOrgBusiness(o.id);
  const payForm = $('payForm'), editForm = $('editForm');
  const priceFor = () => { const p = allPlans.find((x) => x.code === $('pPlan').value); return p ? (($('pCycle').value === 'yearly' ? p.price_yearly_paise : p.price_monthly_paise) / 100) : ''; };
  const fillAmount = () => { $('pAmount').value = priceFor(); };
  $('pPlan').addEventListener('change', fillAmount); $('pCycle').addEventListener('change', fillAmount);
  const delForm = $('delForm');
  body.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => { payForm.hidden = true; editForm.hidden = true; delForm.hidden = true; }));

  const refresh = async (msg) => {
    toast(msg);
    const [nd, np] = await Promise.all([rpc('platform_org', { p_org: o.id }), plans()]);
    renderOrg(nd, np.plans);
    loaded.clear(); loaded.add(currentTab());
    loaders[currentTab()]().catch(() => {});
  };

  body.querySelector('[data-act="pay"]').addEventListener('click', () => { editForm.hidden = true; payForm.hidden = false; fillAmount(); $('pAmount').focus(); });
  body.querySelector('[data-act="edit"]').addEventListener('click', () => { payForm.hidden = true; editForm.hidden = false; $('ePlan').focus(); });
  body.querySelector('[data-act="trial7"]')?.addEventListener('click', async () => {
    const base = Math.max(Date.now(), new Date(s.trial_ends_at).getTime());
    try {
      await rpc('platform_update_subscription', { p_org: o.id, p_plan: s.plan_code, p_status: 'trialing', p_cycle: s.cycle, p_trial_ends_at: new Date(base + 7 * 864e5).toISOString(), p_period_end: s.current_period_end });
      await refresh('Trial extended by 7 days.');
    } catch (err) { fail(err); }
  });
  body.querySelector('[data-act="suspend"]')?.addEventListener('click', async () => {
    if (!window.confirm(`Suspend ${o.name}? Their team can still sign in and see data, but cannot make changes.`)) return;
    try { await rpc('platform_set_org_status', { p_org: o.id, p_status: 'suspended' }); await refresh('Workspace suspended.'); } catch (err) { fail(err); }
  });
  body.querySelector('[data-act="block"]')?.addEventListener('click', async () => {
    if (!window.confirm(`Block ${o.name}? Nobody in this business can open the workspace (not even to read) until you unblock it. Their data is kept.`)) return;
    try { await rpc('platform_set_org_status', { p_org: o.id, p_status: 'blocked' }); await refresh('Business blocked.'); } catch (err) { fail(err); }
  });
  body.querySelector('[data-act="delete"]').addEventListener('click', () => { payForm.hidden = true; editForm.hidden = true; delForm.hidden = false; $('dName').focus(); });
  $('dName').addEventListener('input', () => { $('dGo').disabled = $('dName').value.trim() !== o.name.trim(); });
  delForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if ($('dName').value.trim() !== o.name.trim()) return;
    const btn = $('dGo'); btn.disabled = true; $('dErr').textContent = '';
    try {
      const r = await rpc('platform_delete_org', { p_org: o.id, p_confirm: $('dName').value.trim(), p_delete_logins: $('dLogins').checked });
      closeModal('orgModal');
      toast(`${r.deleted} deleted${r.logins_deleted ? ` · ${r.logins_deleted} login(s) removed` : ''}.`);
      loaded.clear(); loaded.add(currentTab());
      loaders[currentTab()]().catch(fail);
    } catch (err) { $('dErr').textContent = err.message; btn.disabled = false; }
  });
  body.querySelector('[data-act="reactivate"]')?.addEventListener('click', async () => {
    try { await rpc('platform_set_org_status', { p_org: o.id, p_status: 'active' }); await refresh(o.status === 'blocked' ? 'Business unblocked.' : 'Workspace reactivated.'); } catch (err) { fail(err); }
  });

  payForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = Math.round(Number($('pAmount').value) * 100);
    if (!amount || amount <= 0) { $('pErr').textContent = 'Enter the amount received.'; $('pAmount').focus(); return; }
    $('pErr').textContent = '';
    const btn = payForm.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      const r = await rpc('platform_record_payment', {
        p_org: o.id, p_amount_paise: amount, p_plan: $('pPlan').value, p_cycle: $('pCycle').value, p_method: $('pMethod').value,
        p_reference: $('pRef').value || null, p_note: $('pNote').value || null,
        p_paid_at: $('pDate').value ? new Date(`${$('pDate').value}T12:00:00+05:30`).toISOString() : null, p_extend: $('pExtend').checked,
      });
      let mailed = '';
      if ($('pMail').checked && r.payment_id) {
        try { await rpc('send_invoice', { payment_id: r.payment_id }); mailed = ' Invoice emailed.'; }
        catch (err) { mailed = ` Invoice not emailed: ${err.message}`; }
      }
      await refresh((r.current_period_end ? `Payment saved. Paid until ${date(r.current_period_end)}.` : 'Payment saved.') + mailed);
    } catch (err) { $('pErr').textContent = err.message; btn.disabled = false; }
  });

  editForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = $('eStatus').value;
    if (status === 'trialing' && !$('eTrial').value) { $('eErr').textContent = 'Choose when the trial ends.'; $('eTrial').focus(); return; }
    if (status === 'cancelled' && !$('eEnd').value) { $('eErr').textContent = 'Choose the date until which they keep access.'; $('eEnd').focus(); return; }
    $('eErr').textContent = '';
    const btn = editForm.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await rpc('platform_update_subscription', {
        p_org: o.id, p_plan: $('ePlan').value, p_status: status, p_cycle: $('eCycle').value,
        p_trial_ends_at: endOfDay($('eTrial').value), p_period_end: endOfDay($('eEnd').value),
      });
      await refresh('Subscription updated.');
    } catch (err) { $('eErr').textContent = err.message; btn.disabled = false; }
  });
}

// ── BUSINESS TYPES ───────────────────────────────────────────────
const PRODUCT_FEATURES = {
  variants: 'Sizes & colours', auto_barcode: 'Create barcodes', labels: 'Barcode labels', mrp: 'MRP',
  batch_expiry: 'Batch & expiry', loose_weight: 'Loose / by weight', serial_numbers: 'Serial / IMEI',
  unit_conversion: 'Box ↔ piece', track_stock: 'Track stock',
};
const BT_ICONS = ['shirt', 'shopping-cart', 'pill', 'smartphone', 'wrench', 'briefcase', 'store', 'cake'];
const featChips = (f) => { const on = Object.keys(PRODUCT_FEATURES).filter((k) => f && f[k]); return on.length ? `<div class="bk-chips">${on.map((k) => `<span>${e(PRODUCT_FEATURES[k])}</span>`).join('')}</div>` : '<span class="muted">—</span>'; };
const featChecks = (f, name = 'pf') => `<div class="bk-checks">${Object.entries(PRODUCT_FEATURES).map(([k, l]) => `<label><input type="checkbox" name="${name}" value="${k}" ${f && f[k] ? 'checked' : ''}/> ${e(l)}</label>`).join('')}</div>`;
const readFeats = (root, name = 'pf') => Object.fromEntries([...root.querySelectorAll(`[name="${name}"]`)].map((i) => [i.value, i.checked]));
let businessTypes = null;
async function getBusinessTypes(force = false) { if (!businessTypes || force) businessTypes = await rpc('platform_business_types'); return businessTypes; }

loaders.business = async () => {
  const list = await getBusinessTypes(true);
  $('btRows').innerHTML = list.map((x) => x.code ? `<tr>
      <td><div class="bold">${e(x.name)}</div><div class="text-xs text-muted">${e(x.code)}${x.description ? ` · ${e(x.description)}` : ''}</div></td>
      <td>${featChips(x.features)}</td>
      <td class="num">${x.workspaces}</td>
      <td>${x.is_active ? '<span class="st st-good">Shown</span>' : '<span class="st st-muted">Hidden</span>'}</td>
      <td><button class="btn btn-ghost btn-sm" data-bt="${e(x.code)}"><i class="fas fa-pen"></i> Edit</button></td></tr>`
    : `<tr><td><div class="bold muted">${e(x.name)}</div><div class="text-xs text-muted">Workspaces that skipped the question</div></td><td><span class="muted">General features</span></td><td class="num">${x.workspaces}</td><td></td><td></td></tr>`).join('');
  $('btRows').querySelectorAll('[data-bt]').forEach((b) => b.addEventListener('click', () => editBusinessType(list.find((x) => x.code === b.dataset.bt))));
};
$('btNew').addEventListener('click', () => editBusinessType(null));

function editBusinessType(bt) {
  const isNew = !bt;
  const x = bt || { code: '', name: '', description: '', icon: 'store', features: { auto_barcode: true, labels: true, track_stock: true }, sort_order: 80, is_active: true };
  $('btTitle').textContent = isNew ? 'New business type' : `Edit ${x.name}`;
  const f = $('btForm');
  f.innerHTML = `
    <div class="bk-row">
      <div class="form-group"><label class="form-label" for="btName">Name</label><input class="form-input" id="btName" value="${e(x.name)}" maxlength="60" required placeholder="e.g. Bakery & Sweets"/></div>
      <div class="form-group"><label class="form-label" for="btCode">Code</label><input class="form-input" id="btCode" value="${e(x.code)}" ${isNew ? '' : 'readonly'} placeholder="e.g. bakery"/>
        <p class="form-hint">${isNew ? 'Lowercase letters, numbers and _. Cannot change later.' : 'Fixed.'}</p></div>
    </div>
    <div class="form-group"><label class="form-label" for="btDesc">Short description (shown under the name)</label><input class="form-input" id="btDesc" value="${e(x.description || '')}" maxlength="200" placeholder="e.g. Cakes, sweets, snacks"/></div>
    <div class="bk-row">
      <div class="form-group"><label class="form-label" for="btIcon">Icon</label><select class="form-select" id="btIcon">${BT_ICONS.map((i) => `<option value="${i}" ${i === x.icon ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label" for="btSort">Order</label><input class="form-input" id="btSort" type="number" value="${x.sort_order}"/></div>
    </div>
    <div class="form-group"><span class="form-label">Features switched on for this type</span>${featChecks(x.features)}</div>
    <div class="bk-checks"><label><input type="checkbox" id="btActive" ${x.is_active ? 'checked' : ''}/> Shown to customers when they choose their business</label></div>
    ${!isNew && x.workspaces ? `<p class="form-hint">${x.workspaces} workspace(s) use this type. Those who haven't customised their features get the new defaults.</p>` : ''}
    <p class="bk-err" id="btErr" role="alert"></p>
    <div class="modal-footer"><button type="button" class="btn btn-ghost" data-close="btModal">Cancel</button><button class="btn btn-primary" type="submit">${isNew ? 'Create type' : 'Save'}</button></div>`;
  f.querySelector('[data-close="btModal"]').addEventListener('click', () => closeModal('btModal'));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const code = $('btCode').value.trim();
    const err = !/^[a-z][a-z0-9_]{1,30}$/.test(code) ? 'Code: lowercase letters, numbers and _ (2–31 characters).' : $('btName').value.trim().length < 2 ? 'Enter a name.' : '';
    if (err) { $('btErr').textContent = err; return; }
    const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await rpc('platform_save_business_type', { p_code: code, p_type: {
        name: $('btName').value.trim(), description: $('btDesc').value.trim(), icon: $('btIcon').value,
        sort_order: Math.round(Number($('btSort').value) || 100), is_active: $('btActive').checked, features: readFeats(f),
      } });
      closeModal('btModal'); toast(isNew ? 'Business type created.' : 'Business type saved.');
      loaders.business().catch(fail);
    } catch (e2) { $('btErr').textContent = e2.message; btn.disabled = false; }
  };
  openModal('btModal');
}

// Customer page: their business type and features
async function renderOrgBusiness(orgId) {
  const box = $('orgBusiness'); if (!box) return;
  try {
    const [first, list] = await Promise.all([rpc('platform_org_business', { p_org: orgId }), getBusinessTypes()]);
    let b = first;
    const types = list.filter((x) => x.code);
    const draw = () => {
      box.innerHTML = `
        <div class="bk-kv"><div><span>Type</span><b>${e(b.business_type_name || 'Not chosen yet')}</b></div>
          <div><span>Features</span>${featChips(b.features)} ${b.customised ? '<span class="st st-warn">Customised</span>' : ''}</div></div>
        <button class="btn btn-ghost btn-sm" id="obEdit"><i class="fas fa-pen"></i> Change type or features</button>
        <form class="bk-panel" id="obForm" hidden novalidate>
          <div class="form-group"><label class="form-label" for="obType">Business type</label>
            <select class="form-select" id="obType"><option value="">Not chosen</option>${types.map((t) => `<option value="${e(t.code)}" ${t.code === b.business_type ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</select></div>
          <div class="bk-checks"><label><input type="checkbox" id="obCustom" ${b.customised ? 'checked' : ''}/> Use my own feature choices for this customer (instead of the type's defaults)</label></div>
          <div id="obFeats" ${b.customised ? '' : 'hidden'}>${featChecks(b.features, 'obf')}</div>
          <p class="bk-err" id="obErr" role="alert"></p>
          <div class="modal-footer"><button type="button" class="btn btn-ghost" id="obCancel">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>
        </form>`;
      const form = $('obForm');
      $('obEdit').addEventListener('click', () => { form.hidden = false; });
      $('obCancel').addEventListener('click', () => { form.hidden = true; });
      $('obCustom').addEventListener('change', () => { $('obFeats').hidden = !$('obCustom').checked; });
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
        try {
          b = await rpc('platform_set_org_business', { p_org: orgId, p_type: $('obType').value || null, p_features: $('obCustom').checked ? readFeats(form, 'obf') : null });
          toast('Business type saved.'); draw();
        } catch (err) { $('obErr').textContent = err.message; btn.disabled = false; }
      };
    };
    draw();
  } catch (err) { box.innerHTML = `<div class="bk-empty">${e(err.message)}</div>`; }
}

// ── SUPPORT ──────────────────────────────────────────────────────
const TICKET = { open: ['Needs reply', 'st-warn'], pending: ['Replied', 'st-trial'], closed: ['Closed', 'st-muted'] };
const ticketBadge = (s) => { const [l, c] = TICKET[s] || [s, 'st-muted']; return `<span class="st ${c}">${e(l)}</span>`; };
const dateTime = (v) => new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const su = { page: 0 };
let suTimer;
$('suSearch').addEventListener('input', () => { clearTimeout(suTimer); suTimer = setTimeout(() => { su.page = 0; loaders.support().catch(fail); }, 300); });
$('suStatus').addEventListener('change', () => { su.page = 0; loaders.support().catch(fail); });
function setSupportBadge(n) { $('supBadge').hidden = !n; $('supBadge').textContent = String(n || ''); }

loaders.support = async () => {
  const r = await rpc('platform_tickets', { p_status: $('suStatus').value || null, p_search: $('suSearch').value || null, p_limit: PAGE, p_offset: su.page * PAGE });
  setSupportBadge(r.counts.open);
  $('suCount').textContent = `${r.counts.open} need a reply · ${r.counts.pending} replied · ${r.counts.closed} closed`;
  $('suRows').innerHTML = r.rows.length ? r.rows.map((x) => `<tr>
      <td><button class="bk-link" data-ticket="${e(x.id)}">${e(x.subject)}</button><div class="text-xs text-muted">${x.messages} message${x.messages === 1 ? '' : 's'}</div></td>
      <td>${e(x.org_name)}</td>
      <td><div>${e(x.creator_name || '—')}</div><div class="text-xs text-muted">${e(x.creator_email || '')}</div></td>
      <td>${dateTime(x.last_message_at)}<div class="text-xs text-muted">${x.last_from === 'uxonic' ? 'by UXONIC' : 'by customer'}</div></td>
      <td>${ticketBadge(x.status)}</td></tr>`).join('')
    : `<tr><td colspan="5" class="table-empty">${$('suStatus').value === 'open' ? 'Nothing waiting for a reply.' : 'No messages.'}</td></tr>`;
  $('suRows').querySelectorAll('[data-ticket]').forEach((b) => b.addEventListener('click', () => openTicket(b.dataset.ticket)));
  pager($('suPager'), r.total, su.page, (p) => { su.page = p; loaders.support().catch(fail); });
};

async function openTicket(id) {
  $('tkTitle').textContent = 'Loading…'; $('tkSub').textContent = ''; $('tkBody').innerHTML = '';
  openModal('tkModal');
  let d;
  try { d = await rpc('platform_ticket', { p_ticket: id }); } catch (err) { closeModal('tkModal'); fail(err); return; }
  const tk = d.ticket;
  $('tkTitle').textContent = tk.subject;
  $('tkSub').innerHTML = `${ticketBadge(tk.status)} &nbsp; ${e(d.org.name)} · ${e(d.org.plan_name)} · ${e(d.creator?.email || '')}`;
  const msgs = [{ author_kind: 'customer', author_name: d.creator?.name || 'Customer', body: tk.body, created_at: tk.created_at }, ...d.messages];
  $('tkBody').innerHTML = `
    <div class="bk-thread" id="tkThread">${msgs.map((m) => `<div class="bk-msg ${m.author_kind}"><small>${e(m.author_kind === 'uxonic' ? 'UXONIC Support' : (m.author_name || 'Customer'))} · ${dateTime(m.created_at)}</small>${e(m.body)}</div>`).join('')}</div>
    <form id="tkForm" class="bk-form" novalidate>
      <div class="form-group"><label class="form-label" for="tkReply">Your reply</label><textarea class="form-textarea" id="tkReply" rows="4" maxlength="5000" placeholder="Write the answer — the customer gets it in the app and by email."></textarea></div>
      <p class="bk-err" id="tkErr" role="alert"></p>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" data-org="${e(d.org.id)}"><i class="fas fa-building"></i> Customer</button>
        ${tk.status !== 'closed' ? '<button type="button" class="btn btn-ghost" id="tkClose">Close without reply</button>' : ''}
        <button type="submit" class="btn btn-ghost" data-close-after="1">Reply &amp; close</button>
        <button type="submit" class="btn btn-primary">Send reply</button>
      </div>
    </form>`;
  const thread = $('tkThread'); thread.scrollTop = thread.scrollHeight;
  $('tkBody').querySelector('[data-org]').addEventListener('click', () => { closeModal('tkModal'); openOrg(d.org.id); });
  $('tkClose')?.addEventListener('click', async () => {
    try { await rpc('platform_set_ticket_status', { p_ticket: id, p_status: 'closed' }); toast('Conversation closed.'); closeModal('tkModal'); loaders.support().catch(fail); } catch (err) { fail(err); }
  });
  $('tkForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = $('tkReply').value.trim();
    if (!body) { $('tkErr').textContent = 'Write a reply first.'; $('tkReply').focus(); return; }
    $('tkErr').textContent = '';
    const close = ev.submitter?.dataset.closeAfter === '1';
    $('tkForm').querySelectorAll('[type="submit"]').forEach((b) => { b.disabled = true; });
    try {
      const r = await rpc('platform_reply_ticket', { p_ticket: id, p_body: body, p_close: close });
      toast(r.emailed ? 'Reply sent — the customer also got it by email.' : 'Reply sent (shown in their app; email could not be sent).', r.emailed ? 'success' : 'warning');
      closeModal('tkModal');
      loaders.support().catch(fail);
    } catch (err) { $('tkErr').textContent = err.message; $('tkForm').querySelectorAll('[type="submit"]').forEach((b) => { b.disabled = false; }); }
  });
}

// ── PAYMENTS ─────────────────────────────────────────────────────
const pa = { page: 0 };
let paTimer;
$('paSearch').addEventListener('input', () => { clearTimeout(paTimer); paTimer = setTimeout(() => { pa.page = 0; loaders.payments().catch(fail); }, 300); });
loaders.payments = async () => {
  const r = await rpc('platform_payments', { p_search: $('paSearch').value || null, p_limit: PAGE, p_offset: pa.page * PAGE });
  $('paSum').textContent = `${r.total} payments · ${rupees(r.sum_paise)} received`;
  $('paRows').innerHTML = r.rows.length ? r.rows.map((x) => `<tr>
      <td>${date(x.paid_at || x.created_at)}${x.invoice_no ? `<div class="text-xs text-muted">${e(x.invoice_no)}</div>` : ''}</td>
      <td><button class="bk-link" data-org="${e(x.org_id)}">${e(x.org_name)}</button></td>
      <td>${e(x.plan_name || x.plan_code || '—')}${x.cycle ? ` <span class="text-xs text-muted">${x.cycle}</span>` : ''}</td>
      <td>${e(METHODS[x.method] || x.method)}</td>
      <td class="muted">${e(x.reference || x.rzp_payment_id || '—')}${x.note ? `<div class="text-xs">${e(x.note)}</div>` : ''}</td>
      <td class="num bold">${rupeesExact(x.amount_paise)}</td>
      <td>${x.status === 'captured' ? '<span class="st st-good">Received</span>' : x.status === 'refunded' ? '<span class="st st-muted">Refunded</span>' : '<span class="st st-bad">Failed</span>'}</td>
      <td class="nowrap">${x.invoice_no && x.status === 'captured' ? `<button class="btn btn-ghost btn-sm" data-invoice="${e(x.id)}" data-sent="${x.receipt_sent_at ? '1' : ''}" title="${x.receipt_sent_at ? `Emailed ${date(x.receipt_sent_at)}` : 'Not emailed yet'}"><i class="fas fa-envelope"></i> ${x.receipt_sent_at ? 'Resend' : 'Send'} invoice</button>` : ''}
        ${x.method !== 'razorpay' ? `<button class="btn btn-ghost btn-sm" data-refund="${e(x.id)}" data-to="${x.status === 'refunded' ? 'captured' : 'refunded'}">${x.status === 'refunded' ? 'Undo refund' : 'Mark refunded'}</button>` : ''}</td></tr>`).join('')
    : '<tr><td colspan="8" class="table-empty">No payments yet.</td></tr>';
  $('paRows').querySelectorAll('[data-invoice]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.sent && !window.confirm('This invoice was already emailed. Send it again?')) return;
    b.disabled = true;
    try { const r = await rpc('send_invoice', { payment_id: b.dataset.invoice, resend: !!b.dataset.sent }); toast(r?.status === 'already' ? 'The invoice was already emailed.' : 'Invoice emailed.'); loaders.payments().catch(fail); }
    catch (err) { fail(err); b.disabled = false; }
  }));
  $('paRows').querySelectorAll('[data-refund]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.to === 'refunded' && !window.confirm('Mark this payment as refunded? It will no longer count as revenue.')) return;
    try { await rpc('platform_set_payment_status', { p_payment: b.dataset.refund, p_status: b.dataset.to }); toast('Payment updated.'); loaders.payments().catch(fail); } catch (err) { fail(err); }
  }));
  pager($('paPager'), r.total, pa.page, (p) => { pa.page = p; loaders.payments().catch(fail); });
};

// ── PLANS ────────────────────────────────────────────────────────
loaders.plans = async () => {
  const p = await plans(true);
  const n = (v) => (v === null || v === undefined ? 'Unlimited' : Number(v).toLocaleString('en-IN'));
  $('plRows').innerHTML = p.plans.map((x) => `<tr>
      <td><div class="bold">${e(x.name)}</div><div class="text-xs text-muted">${e(x.code)} · ${x.kind === 'suite' ? 'UXONIC Books' : 'Single app'}</div></td>
      <td>${x.modules.map((m) => APP_NAMES[m] || m).join(' · ')}</td>
      <td class="num">${rupees(x.price_monthly_paise)}</td><td class="num">${rupees(x.price_yearly_paise)}</td>
      <td class="num">${x.max_users}</td><td class="num">${n(x.max_contacts)}</td>
      <td class="num">${x.modules.includes('hr') ? n(x.max_employees) : '—'}</td>
      <td class="num">${x.workspaces}</td>
      <td>${x.is_active ? '<span class="st st-good">On sale</span>' : '<span class="st st-muted">Hidden</span>'}</td>
      <td><button class="btn btn-ghost btn-sm" data-plan="${e(x.code)}"><i class="fas fa-pen"></i> Edit</button></td></tr>`).join('');
  $('plRows').querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => editPlan(p.plans.find((x) => x.code === b.dataset.plan), p)));
};
$('plNew').addEventListener('click', async () => { try { editPlan(null, await plans()); } catch (err) { fail(err); } });

function editPlan(plan, p) {
  const isNew = !plan;
  const x = plan || { code: '', name: '', kind: 'suite', tagline: '', price_monthly_paise: 0, price_yearly_paise: 0, max_users: 2, max_contacts: 1000, max_invoices_per_month: null, max_employees: null, modules: ['crm', 'billing', 'erp', 'hr'], features: {}, is_active: false, sort_order: 50 };
  const num = (v) => (v === null || v === undefined ? '' : v);
  $('planTitle').textContent = isNew ? 'New plan' : `Edit ${x.name}`;
  $('planForm').innerHTML = `
    <div class="bk-row">
      <div class="form-group"><label class="form-label" for="fName">Name</label><input class="form-input" id="fName" value="${e(x.name)}" maxlength="60" required/></div>
      <div class="form-group"><label class="form-label" for="fCode">Code</label><input class="form-input" id="fCode" value="${e(x.code)}" ${isNew ? '' : 'readonly'} pattern="[a-z][a-z0-9_]{1,30}" placeholder="e.g. books_pro"/>
        <p class="form-hint">${isNew ? 'Lowercase letters, numbers and _. Used in sign-up links (?plan=code). Cannot change later.' : 'Sign-up link: …/signup?plan=' + e(x.code)}</p></div>
    </div>
    <div class="form-group"><label class="form-label" for="fTag">One line for the pricing card</label><input class="form-input" id="fTag" value="${e(x.tagline || '')}" maxlength="160"/></div>
    <div class="bk-row-4">
      <div class="form-group"><label class="form-label" for="fType">Type</label><select class="form-select" id="fType"><option value="suite">UXONIC Books</option><option value="app" ${x.kind === 'app' ? 'selected' : ''}>Single app</option></select></div>
      <div class="form-group"><label class="form-label" for="fMonth">Monthly price (₹)</label><input class="form-input" id="fMonth" type="number" min="0" step="1" value="${x.price_monthly_paise / 100}" required/></div>
      <div class="form-group"><label class="form-label" for="fYear">Yearly price (₹)</label><input class="form-input" id="fYear" type="number" min="0" step="1" value="${x.price_yearly_paise / 100}" required/>
        <p class="form-hint"><button type="button" class="bk-link" id="fYear10">= 10 × monthly</button></p></div>
      <div class="form-group"><label class="form-label" for="fSort">Order</label><input class="form-input" id="fSort" type="number" value="${x.sort_order}"/></div>
    </div>
    <div class="bk-row-4">
      <div class="form-group"><label class="form-label" for="fUsers">Users</label><input class="form-input" id="fUsers" type="number" min="1" value="${x.max_users}" required/></div>
      <div class="form-group"><label class="form-label" for="fContacts">Contacts</label><input class="form-input" id="fContacts" type="number" min="0" value="${x.max_contacts}" required/></div>
      <div class="form-group"><label class="form-label" for="fInv">Invoices / month</label><input class="form-input" id="fInv" type="number" min="0" value="${num(x.max_invoices_per_month)}" placeholder="Unlimited"/></div>
      <div class="form-group"><label class="form-label" for="fStaff">Staff in HR</label><input class="form-input" id="fStaff" type="number" min="0" value="${num(x.max_employees)}" placeholder="Unlimited"/></div>
    </div>
    <div class="form-group"><span class="form-label">Apps included</span>
      <div class="bk-checks">${p.modules.map((m) => `<label><input type="checkbox" name="mod" value="${e(m.key)}" ${x.modules.includes(m.key) ? 'checked' : ''}/> ${e(m.name)}</label>`).join('')}</div></div>
    <div class="form-group"><span class="form-label">Features</span>
      <div class="bk-checks">${Object.entries(FEATURES).map(([k, l]) => `<label><input type="checkbox" name="feat" value="${k}" ${x.features[k] ? 'checked' : ''}/> ${e(l)}</label>`).join('')}</div></div>
    <div class="bk-checks"><label><input type="checkbox" id="fActive" ${x.is_active ? 'checked' : ''}/> On sale (shown on the website and in the app)</label></div>
    ${!isNew && x.workspaces ? `<p class="form-hint">${x.workspaces} workspace(s) use this plan. New limits apply to them too; their price changes from their next payment.</p>` : ''}
    <p class="bk-err" id="fErr" role="alert"></p>
    <div class="modal-footer"><button type="button" class="btn btn-ghost" data-close-plan>Cancel</button><button class="btn btn-primary" type="submit">${isNew ? 'Create plan' : 'Save plan'}</button></div>`;
  const f = $('planForm');
  $('fYear10').addEventListener('click', () => { $('fYear').value = Math.round(Number($('fMonth').value || 0) * 10); });
  f.querySelector('[data-close-plan]').addEventListener('click', () => closeModal('planModal'));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const code = $('fCode').value.trim();
    const optInt = (v) => (v.trim() === '' ? null : Math.round(Number(v)));
    const modules = [...f.querySelectorAll('[name="mod"]:checked')].map((i) => i.value);
    const features = Object.fromEntries([...f.querySelectorAll('[name="feat"]')].map((i) => [i.value, i.checked]).filter(([, v]) => v));
    const err = !/^[a-z][a-z0-9_]{1,30}$/.test(code) ? 'Code: lowercase letters, numbers and _ (2–31 characters).'
      : $('fName').value.trim().length < 2 ? 'Enter a plan name.'
      : !modules.length ? 'Choose at least one app.'
      : $('fType').value === 'app' && modules.length !== 1 ? 'A single-app plan includes exactly one app.'
      : Number($('fUsers').value) < 1 ? 'Users must be at least 1.' : '';
    if (err) { $('fErr').textContent = err; return; }
    $('fErr').textContent = '';
    const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await rpc('platform_save_plan', { p_code: code, p: {
        name: $('fName').value.trim(), kind: $('fType').value, tagline: $('fTag').value.trim(),
        price_monthly_paise: Math.round(Number($('fMonth').value) * 100), price_yearly_paise: Math.round(Number($('fYear').value) * 100),
        max_users: Math.round(Number($('fUsers').value)), max_contacts: Math.round(Number($('fContacts').value)),
        max_invoices_per_month: optInt($('fInv').value), max_employees: optInt($('fStaff').value),
        modules, features, is_active: $('fActive').checked, sort_order: Math.round(Number($('fSort').value) || 100),
      } });
      closeModal('planModal');
      toast(isNew ? 'Plan created.' : 'Plan saved — the website shows the new price now.');
      loaders.plans().catch(fail);
    } catch (e2) { $('fErr').textContent = e2.message; btn.disabled = false; }
  };
  openModal('planModal');
}

// ── SETTINGS ─────────────────────────────────────────────────────
loaders.settings = async () => {
  const p = await plans(true);
  $('stDays').value = p.settings.trial_days ?? 14;
  $('stPlan').innerHTML = p.plans.filter((x) => x.is_active).map((x) => `<option value="${e(x.code)}" ${x.code === p.settings.trial_plan ? 'selected' : ''}>${e(x.name)}</option>`).join('');
};
$('stForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const days = Number($('stDays').value);
  if (!Number.isInteger(days) || days < 1 || days > 90) { toast('Trial length must be 1 to 90 days.', 'error'); return; }
  try { await rpc('platform_save_settings', { p_trial_days: days, p_trial_plan: $('stPlan').value }); toast('Trial settings saved.'); plansCache = null; } catch (err) { fail(err); }
});

// ── start ────────────────────────────────────────────────────────
(async () => {
  try {
    await rpc('platform_plans'); // proves the connection before showing anything
  } catch (err) { showProblem(err.message); return; }
  $('bkGate').hidden = true; $('bkApp').hidden = false;
  showTab(location.hash.slice(1) || 'overview');
  // Badge on the Support tab: conversations waiting for a reply.
  rpc('platform_tickets', { p_status: 'open', p_limit: 1, p_offset: 0 }).then((r) => setSupportBadge(r.counts.open)).catch(() => {});
})();
