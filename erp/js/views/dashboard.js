import { api, esc, money, fdate, fmonth, num, badge, pageHead, empty, canView } from '../core.js';

const stat = (icon, label, value, sub = '', href = '') => `
  <${href ? `a href="${href}"` : 'div'} class="stat">
    <span class="stat-ic"><i class="fas ${icon}"></i></span>
    <span class="stat-label">${esc(label)}</span>
    <span class="stat-val">${value}</span>
    ${sub ? `<span class="stat-sub">${sub}</span>` : ''}
  </${href ? 'a' : 'div'}>`;

export default async function dashboard(root, _p, _q, alive) {
  const d = await api.get('dashboard');
  if (!alive()) return;
  const a = d.attendance;
  const marked = a.present + a['half-day'] + a.absent + a.leave + a.holiday;
  const td = d.todo;
  const todo = [
    canView('leaves') && td.pending_leaves && [`#/leaves`, 'fa-umbrella-beach', `${td.pending_leaves} leave request(s) to approve`],
    d.invoices && d.invoices.overdue_count &&['#/invoices?status=overdue', 'fa-triangle-exclamation', `${d.invoices.overdue_count} overdue invoice(s)`],
    canView('quotes') && td.quotes_accepted && ['#/quotes?status=accepted', 'fa-file-signature', `${td.quotes_accepted} accepted quote(s) to invoice`],
    canView('tasks') && td.overdue_tasks && ['#/tasks', 'fa-list-check', `${td.overdue_tasks} overdue task(s)`],
    canView('attendance') && a.unmarked && ['#/attendance', 'fa-calendar-xmark', `${a.unmarked} not marked today`],
  ].filter(Boolean);
  const pnl = d.month_pnl;

  root.innerHTML = `
    ${pageHead('Good day 👋', `${fdate(d.today)} · ${fmonth(d.month)} overview`,
      `${canView('attendance') ? '<a class="btn btn-ghost" href="#/attendance"><i class="fas fa-calendar-check"></i> Mark attendance</a>' : ''}
       ${canView('invoices') ? '<a class="btn btn-primary" href="#/invoices/new"><i class="fas fa-plus"></i> New invoice</a>' : ''}`)}

    <div class="stats">
      ${stat('fa-users', 'Active employees', num(d.employees.active), `${money(d.employees.monthly_salary_total)} / month salaries`, '#/employees')}
      ${stat('fa-user-check', 'Present today', `${num(a.present + a['half-day'] * 0.5)}<small>/${d.employees.expected_today}</small>`,
        a.unmarked ? `<span class="t-red">${a.unmarked} not marked yet</span>` : 'All marked', canView('attendance') ? '#/attendance' : '')}
      ${stat('fa-money-check-dollar', `Payroll · ${fmonth(d.month)}`, money(d.payroll.total),
        d.payroll.generated ? `${money(d.payroll.paid)} paid` : 'Not generated yet', '#/payroll')}
      ${d.invoices ? `
      ${stat('fa-hourglass-half', 'Outstanding', money(d.invoices.outstanding),
        d.invoices.overdue_count ? `<span class="t-red">${d.invoices.overdue_count} overdue</span>` : 'Nothing overdue', '#/invoices')}
      ${stat('fa-indian-rupee-sign', 'Received this month', money(d.invoices.received_month), `${money(d.invoices.received_fy)} this FY`)}
      ${stat('fa-file-invoice', 'Invoiced this FY', money(d.invoices.invoiced_fy), `${d.clients.total} clients`, '#/clients')}` : ''}
    </div>

    ${todo.length ? `<div class="todo">${todo.map(([href, icon, text]) => `<a href="${href}"><i class="fas ${icon}"></i>${esc(text)}<i class="fas fa-arrow-right"></i></a>`).join('')}</div>` : ''}

    ${pnl ? `<section class="panel pnl">
      <div class="panel-head"><h2>${fmonth(d.month)} so far</h2><a href="#/reports" class="link">Full P&amp;L <i class="fas fa-arrow-right"></i></a></div>
      <div class="pnl-row">
        <div><span>Received</span><b>${money(pnl.received)}</b></div><i class="fas fa-minus"></i>
        <div><span>Salaries</span><b>${money(pnl.payroll)}</b></div><i class="fas fa-minus"></i>
        <div><span>Expenses</span><b>${money(pnl.expenses)}</b></div><i class="fas fa-equals"></i>
        <div class="${pnl.profit < 0 ? 't-red' : 't-green'}"><span>${pnl.profit < 0 ? 'Loss' : 'Profit'}</span><b>${money(Math.abs(pnl.profit))}</b></div>
      </div></section>` : ''}

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Today's attendance</h2><a href="#/attendance" class="link">Open <i class="fas fa-arrow-right"></i></a></div>
        ${d.employees.active ? `
          <div class="att-bar">
            ${['present', 'half-day', 'leave', 'holiday', 'absent'].map((s) => a[s] ? `<span class="seg seg-${s}" style="flex:${a[s]}" title="${s}: ${a[s]}"></span>` : '').join('')}
            ${a.unmarked ? `<span class="seg seg-none" style="flex:${a.unmarked}" title="Not marked: ${a.unmarked}"></span>` : ''}
          </div>
          <div class="legend">
            ${['present', 'half-day', 'leave', 'holiday', 'absent'].map((s) => `<span><i class="dot dot-${s}"></i>${s.replace('-', ' ')} <b>${a[s]}</b></span>`).join('')}
            <span><i class="dot dot-none"></i>not marked <b>${a.unmarked}</b></span>
          </div>
          ${!marked ? '<p class="muted mt">Attendance for today has not been marked.</p>' : ''}
          ${d.employees.self_checked_in ? `<p class="muted small mt"><i class="fas fa-mobile-screen"></i> ${d.employees.self_checked_in} checked in themselves from the employee portal.</p>` : ''}`
        : empty('fa-users', 'Add employees to start tracking attendance.', '<a class="btn btn-primary" href="#/employees">Add employee</a>')}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Work by product · ${fmonth(d.month)}</h2><a href="#/products" class="link">All products <i class="fas fa-arrow-right"></i></a></div>
        ${d.products.effort.length ? `<div class="bars">${(() => {
          const max = Math.max(...d.products.effort.map((p) => p.days));
          return d.products.effort.map((p) => `
            <a class="bar-row" href="#/products/${p.id}">
              <span class="bar-name">${esc(p.name)}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${(p.days / max) * 100}%"></span></span>
              <span class="bar-val">${num(p.days)} days</span>
            </a>`).join('');
        })()}</div>`
        : empty('fa-cubes', 'No product work logged this month. Pick a product when marking attendance.')}
      </section>
    </div>

    ${!d.invoices ? '' : `<section class="panel">
      <div class="panel-head"><h2>Recent invoices</h2><a href="#/invoices" class="link">All invoices <i class="fas fa-arrow-right"></i></a></div>
      ${d.invoices.recent.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Due</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead>
          <tbody>${d.invoices.recent.map((i) => `
            <tr class="click" data-href="#/invoices/${i.id}">
              <td><b>${esc(i.invoice_no)}</b></td><td>${esc(i.erp_clients?.name || '—')}</td>
              <td>${fdate(i.issue_date)}</td><td>${fdate(i.due_date)}</td>
              <td class="r">${money(i.total)}</td><td class="r">${money(Number(i.total) - Number(i.amount_paid))}</td>
              <td>${badge(i.effective_status)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`
        : empty('fa-file-invoice', 'No invoices yet.', '<a class="btn btn-primary" href="#/invoices/new">Create first invoice</a>')}
    </section>`}`;

  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
}
