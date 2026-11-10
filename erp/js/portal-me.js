// Employee self-service portal (/erp/me)
import { api, Auth, esc, money, fdate, fmonth, num, badge, toast, toastErr, spinner, errorView } from './core.js';
import { renderLogin } from './login.js';
import { payslipDoc } from './docs.js';
import { ymd } from './calc.js';

Auth.use('employee');
const root = document.getElementById('root');
const LT = { casual: 'Casual', sick: 'Sick', unpaid: 'Unpaid' };
const leaveBadge = (s) => badge({ pending: 'sent', approved: 'active', rejected: 'absent', cancelled: 'draft' }[s] || s, s);

function shell(name, body) {
  return `
    <header class="portal-top">
      <div class="auth-brand"><span class="brand-chip"><img src="/images/nav-logo-sm.png" alt=""></span><div><b>UXONIC</b><small>Employee portal</small></div></div>
      <div class="portal-user"><span class="avatar sm">${esc(name.charAt(0))}</span><button class="icon-btn" id="logout" aria-label="Sign out" title="Sign out"><i class="fas fa-right-from-bracket"></i></button></div>
    </header>
    <div class="portal-body">${body}</div>`;
}

async function home() {
  root.innerHTML = spinner();
  const d = await api.get('me');
  const a = d.attendance_today;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const lb = d.leave_balance;
  const products = d.products;

  let todayCard;
  if (a?.source === 'leave') todayCard = `<p class="today-state"><i class="fas fa-umbrella-beach"></i> You're on approved leave today. Enjoy!</p>`;
  else if (a?.check_out) todayCard = `<p class="today-state"><i class="fas fa-circle-check t-green"></i> Checked in ${esc(a.check_in)} · out ${esc(a.check_out)} ${badge(a.status)}</p>`;
  else if (a?.check_in) todayCard = `<p class="today-state"><i class="fas fa-clock"></i> Checked in at <b>${esc(a.check_in)}</b></p><button class="btn btn-ghost btn-block btn-lg" id="checkout"><i class="fas fa-right-from-bracket"></i> Check out</button>`;
  else if (a) todayCard = `<p class="today-state">${badge(a.status)} marked by HR for today.</p>`;
  else todayCard = `
    ${d.is_weekly_off ? '<p class="muted">Today is a weekly off — check in only if you are working.</p>' : ''}
    ${products.length ? `<div class="field"><label for="ciProd">Working on</label><select id="ciProd"><option value="">— Select —</option>${products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>` : ''}
    <button class="btn btn-primary btn-block btn-lg" id="checkin"><i class="fas fa-fingerprint"></i> Check in now</button>`;

  root.innerHTML = shell(d.profile.name, `
    <section class="hello"><h1>${greeting}, ${esc(d.profile.name.split(' ')[0])}</h1><p class="muted">${[d.profile.designation, d.profile.emp_code, fdate(d.today)].filter(Boolean).map(esc).join(' · ')}</p></section>

    <section class="panel today-card"><div class="panel-head"><h2>Today</h2></div>${todayCard}</section>

    <div class="chips-row">
      <span><b>${d.month.present}</b> present</span><span><b>${d.month.half}</b> half day</span><span><b>${d.month.leave}</b> leave</span><span><b>${d.month.absent}</b> absent</span>
      <small class="muted">this month</small>
    </div>

    ${products.length ? `<section class="panel">
      <div class="panel-head"><h2>Today's timesheet</h2><small class="muted">optional · split your day across projects</small></div>
      <div id="tsRows">${(d.timesheet_today.length ? d.timesheet_today : [{}]).map((r) => tsRow(r, products)).join('')}</div>
      <div class="ts-actions"><button class="btn btn-ghost btn-sm" id="tsAdd"><i class="fas fa-plus"></i> Add row</button><button class="btn btn-primary btn-sm" id="tsSave"><i class="fas fa-floppy-disk"></i> Save hours</button></div>
    </section>` : ''}

    <section class="panel">
      <div class="panel-head"><h2>My tasks</h2><span class="badge badge-grey">${d.tasks.length} open</span></div>
      ${d.tasks.length ? `<ul class="list">${d.tasks.map((t) => `<li class="task-li"><div><b>${esc(t.title)}</b><small class="block muted">${esc(t.erp_products?.name || '')}${t.due_date ? ' · due ' + fdate(t.due_date) : ''}</small></div>
        <select data-task="${t.id}" aria-label="Status for ${esc(t.title)}">${[['todo', 'To do'], ['doing', 'In progress'], ['review', 'Review'], ['done', 'Done']].map(([v, l]) => `<option value="${v}" ${v === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select></li>`).join('')}</ul>`
        : '<p class="muted">No open tasks. 🎉</p>'}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Leave · ${esc(lb.year)}</h2></div>
      <div class="leave-bal">
        <div><span>Casual</span><b>${num(lb.casual.left)}</b><small>of ${num(lb.casual.quota)} left</small></div>
        <div><span>Sick</span><b>${num(lb.sick.left)}</b><small>of ${num(lb.sick.quota)} left</small></div>
        <div><span>Unpaid taken</span><b>${num(lb.unpaid.used)}</b><small>days</small></div>
      </div>
      <form id="lf" class="form-grid mt" novalidate>
        <div class="field"><label for="lt">Type</label><select id="lt"><option value="casual">Casual (paid)</option><option value="sick">Sick (paid)</option><option value="unpaid">Unpaid</option></select></div>
        <div class="field"><label for="lr">Reason</label><input id="lr" maxlength="200" placeholder="Optional"></div>
        <div class="field"><label for="lfrom">From</label><input type="date" id="lfrom" value="${ymd(new Date())}" required></div>
        <div class="field"><label for="lto">To</label><input type="date" id="lto" value="${ymd(new Date())}" required></div>
        <div class="span-2"><button class="btn btn-primary btn-block" type="submit"><i class="fas fa-paper-plane"></i> Request leave</button></div>
      </form>
      ${d.leaves.length ? `<ul class="list mt">${d.leaves.map((l) => `<li><span>${LT[l.leave_type]} · ${fdate(l.from_date)}${l.to_date !== l.from_date ? ' → ' + fdate(l.to_date) : ''} <small class="muted">(${num(l.days)} d)</small></span>
        <span>${leaveBadge(l.status)} ${l.status === 'pending' ? `<button class="btn btn-ghost btn-xs" data-withdraw="${l.id}">Withdraw</button>` : ''}</span></li>`).join('')}</ul>` : ''}
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Payslips</h2></div>
      ${d.payslips.length ? `<ul class="list">${d.payslips.map((p) => `<li><a href="#payslip/${p.id}"><span><b>${fmonth(p.month)}</b> <small class="muted">paid ${fdate(p.paid_on)}</small></span><span>${money(p.net_pay)} <i class="fas fa-chevron-right muted"></i></span></a></li>`).join('')}</ul>` : '<p class="muted">Payslips appear here once salary is paid.</p>'}
    </section>
    <p class="muted small center">Questions about pay or leave? Contact HR.</p>`);

  const $ = (s) => root.querySelector(s);
  $('#logout').addEventListener('click', () => Auth.logout());
  const act = async (btn, fn) => { btn.disabled = true; try { const r = await fn(); toast(r.message); home(); } catch (err) { toastErr(err); btn.disabled = false; } };
  $('#checkin')?.addEventListener('click', (e) => act(e.currentTarget, () => api.post('me-checkin', { product_id: $('#ciProd')?.value || null })));
  $('#checkout')?.addEventListener('click', (e) => { if (confirm('Check out for the day?')) act(e.currentTarget, () => api.post('me-checkout', {})); });
  $('#tsAdd')?.addEventListener('click', () => $('#tsRows').insertAdjacentHTML('beforeend', tsRow({}, products)));
  $('#tsRows')?.addEventListener('click', (e) => { if (e.target.closest('[data-rmrow]')) e.target.closest('.ts-row').remove(); });
  $('#tsSave')?.addEventListener('click', (e) => {
    const entries = [...root.querySelectorAll('#tsRows .ts-row')].map((r) => ({ product_id: r.querySelector('select').value, hours: r.querySelector('.h').value, note: r.querySelector('.n').value }))
      .filter((x) => x.product_id && Number(x.hours) > 0);
    act(e.currentTarget, () => api.post('me-timesheet', { date: d.today, entries }));
  });
  root.querySelectorAll('[data-task]').forEach((sel) => sel.addEventListener('change', async () => {
    try { const r = await api.put('me-tasks', sel.dataset.task, { status: sel.value }); toast(r.message); if (sel.value === 'done') home(); } catch (err) { toastErr(err); }
  }));
  $('#lf').addEventListener('submit', (e) => {
    e.preventDefault();
    act(e.submitter, () => api.post('me-leaves', { leave_type: $('#lt').value, from_date: $('#lfrom').value, to_date: $('#lto').value, reason: $('#lr').value }));
  });
  root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Withdraw this leave request?')) act(b, () => api.del('me-leaves', { id: b.dataset.withdraw }));
  }));
}

function tsRow(r, products) {
  return `<div class="ts-row">
    <select aria-label="Project"><option value="">— Project —</option>${products.map((p) => `<option value="${p.id}" ${String(p.id) === String(r.product_id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <input class="h" type="number" min="0" max="24" step="0.25" inputmode="decimal" placeholder="Hours" value="${esc(r.hours ?? '')}" aria-label="Hours">
    <input class="n" placeholder="What did you work on?" value="${esc(r.note ?? '')}" aria-label="Note">
    <button class="icon-btn" data-rmrow aria-label="Remove row"><i class="fas fa-xmark"></i></button>
  </div>`;
}

async function payslip(id) {
  root.innerHTML = spinner();
  const { payslip: p, settings: s } = await api.get('me-payslip', { id });
  root.innerHTML = shell(p.erp_employees?.full_name || 'Me', `
    <div class="page-head no-print"><div><h1>Payslip</h1><p>${fmonth(p.month)}</p></div>
      <div class="page-actions"><a class="btn btn-ghost" href="#"><i class="fas fa-arrow-left"></i> Back</a><button class="btn btn-primary" onclick="window.print()"><i class="fas fa-download"></i> Save PDF</button></div></div>
    ${payslipDoc(p, s)}`);
  root.querySelector('#logout').addEventListener('click', () => Auth.logout());
}

async function route() {
  if (!Auth.token()) {
    renderLogin(root, { kind: 'employee', title: 'Employee portal', subtitle: 'Use the email HR has on file. We will send you a one-time code.', onSuccess: () => { location.hash = ''; route(); } });
    return;
  }
  const m = location.hash.match(/^#payslip\/(\d+)$/);
  try { m ? await payslip(m[1]) : await home(); window.scrollTo(0, 0); }
  catch (err) { errorView(root, err, route); }
}
window.addEventListener('hashchange', route);
route();
