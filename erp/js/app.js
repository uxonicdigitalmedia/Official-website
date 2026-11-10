// ================================================================
// UXONIC ERP (staff app) — hash router
// ================================================================
import { api, Auth, Me, canView, errorView, spinner, esc } from './core.js';
import dashboard from './views/dashboard.js';
import { employeesList, employeeDetail } from './views/employees.js';
import { attendanceDay, attendanceMonth } from './views/attendance.js';
import { payrollView, payslipView } from './views/payroll.js';
import { clientsList, clientDetail } from './views/clients.js';
import { productsList, productDetail } from './views/products.js';
import { invoicesList, invoiceEditor, invoiceDetail } from './views/invoices.js';
import { quotesList, quoteEditor, quoteDetail } from './views/quotes.js';
import settingsView from './views/settings.js';
import { expensesView } from './views/expenses.js';
import { reportsView, gstView } from './views/reports.js';
import { leavesView, advancesView, timesheetsView } from './views/hr.js';
import { recurringList, recurringEditor } from './views/recurring.js';
import { tasksView } from './views/tasks.js';
import { usersView, auditView } from './views/system.js';

Auth.use('staff');

// [pattern, view, nav key, title, required resource]
const ROUTES = [
  [/^\/dashboard$/, dashboard, 'dashboard', 'Dashboard', 'dashboard'],
  [/^\/reports$/, reportsView, 'reports', 'Reports & P&L', 'reports'],
  [/^\/employees$/, employeesList, 'employees', 'Employees', 'employees'],
  [/^\/employees\/(\d+)$/, employeeDetail, 'employees', 'Employee', 'employees'],
  [/^\/attendance$/, attendanceDay, 'attendance', 'Attendance', 'attendance'],
  [/^\/attendance\/month$/, attendanceMonth, 'attendance', 'Monthly attendance', 'attendance'],
  [/^\/timesheets$/, timesheetsView, 'timesheets', 'Timesheets', 'timesheets'],
  [/^\/leaves$/, leavesView, 'leaves', 'Leave', 'leaves'],
  [/^\/payroll$/, payrollView, 'payroll', 'Payroll', 'payroll'],
  [/^\/payslip\/(\d+)$/, payslipView, 'payroll', 'Payslip', 'payroll'],
  [/^\/advances$/, advancesView, 'advances', 'Advances & loans', 'advances'],
  [/^\/products$/, productsList, 'products', 'Products & Apps', 'products'],
  [/^\/products\/(\d+)$/, productDetail, 'products', 'Product', 'products'],
  [/^\/tasks$/, tasksView, 'tasks', 'Tasks', 'tasks'],
  [/^\/clients$/, clientsList, 'clients', 'Clients', 'clients'],
  [/^\/clients\/(\d+)$/, clientDetail, 'clients', 'Client', 'clients'],
  [/^\/quotes$/, quotesList, 'quotes', 'Quotations', 'quotes'],
  [/^\/quotes\/new$/, quoteEditor, 'quotes', 'New quotation', 'quotes'],
  [/^\/quotes\/(\d+)\/edit$/, quoteEditor, 'quotes', 'Edit quotation', 'quotes'],
  [/^\/quotes\/(\d+)$/, quoteDetail, 'quotes', 'Quotation', 'quotes'],
  [/^\/invoices$/, invoicesList, 'invoices', 'Invoices', 'invoices'],
  [/^\/invoices\/new$/, invoiceEditor, 'invoices', 'New invoice', 'invoices'],
  [/^\/invoices\/(\d+)\/edit$/, invoiceEditor, 'invoices', 'Edit invoice', 'invoices'],
  [/^\/invoices\/(\d+)$/, invoiceDetail, 'invoices', 'Invoice', 'invoices'],
  [/^\/recurring$/, recurringList, 'recurring', 'Recurring billing', 'recurring'],
  [/^\/recurring\/new$/, recurringEditor, 'recurring', 'New schedule', 'recurring'],
  [/^\/recurring\/(\d+)$/, recurringEditor, 'recurring', 'Edit schedule', 'recurring'],
  [/^\/expenses$/, expensesView, 'expenses', 'Expenses', 'expenses'],
  [/^\/gst$/, gstView, 'gst', 'GST report', 'gst'],
  [/^\/settings$/, settingsView, 'settings', 'Company settings', 'users'],
  [/^\/users$/, usersView, 'users', 'Team & roles', 'users'],
  [/^\/audit$/, auditView, 'audit', 'Audit log', 'audit'],
];

const view = document.getElementById('view');
let renderId = 0;
const home = () => (canView('dashboard') ? '#/dashboard' : '#/products');

async function render() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const match = ROUTES.find(([re]) => re.test(path));
  if (!match) { location.hash = home(); return; }
  const [re, fn, nav, title, need] = match;
  if (!canView(need)) {
    view.innerHTML = `<div class="empty"><i class="fas fa-lock"></i><p>Your role (${esc(Me.role)}) doesn't have access to ${esc(title)}.</p><a class="btn btn-ghost" href="${home()}">Go back</a></div>`;
    return;
  }
  const params = path.match(re).slice(1);

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  document.getElementById('crumb').textContent = title;
  document.title = `${title} · UXONIC ERP`;
  closeMenu();

  window.onbeforeunload = null; // views that track unsaved edits set this again
  const id = ++renderId;
  view.innerHTML = spinner();
  window.scrollTo(0, 0);
  try {
    await fn(view, params, query, () => id === renderId);
  } catch (err) {
    if (id === renderId) errorView(view, err, render);
  }
}

// ---------------- chrome ----------------
const side = document.getElementById('side');
const scrim = document.getElementById('scrim');
function closeMenu() { side.classList.remove('open'); scrim.classList.remove('open'); }
document.getElementById('menuBtn').addEventListener('click', () => { side.classList.add('open'); scrim.classList.add('open'); });
scrim.addEventListener('click', closeMenu);
document.getElementById('logout').addEventListener('click', () => Auth.logout());

function applyRole() {
  document.querySelectorAll('[data-need]').forEach((el) => { el.hidden = !canView(el.dataset.need); });
  // hide section labels with nothing visible under them
  document.querySelectorAll('.side-label[data-group]').forEach((label) => {
    let el = label.nextElementSibling, any = false;
    while (el && !el.classList.contains('side-label')) { if (!el.hidden) any = true; el = el.nextElementSibling; }
    label.hidden = !any;
  });
  document.getElementById('who-name').textContent = Me.user?.name || 'Admin';
  document.getElementById('who-role').textContent = { admin: 'Admin', hr: 'HR', accountant: 'Accounts' }[Me.role] || Me.role;
  document.getElementById('who-av').textContent = (Me.user?.name || 'A').charAt(0).toUpperCase();
}

async function refreshBadges() {
  if (!canView('leaves')) return;
  try {
    const { leaves } = await api.get('leaves', { status: 'pending' });
    const b = document.getElementById('navLeaves');
    b.textContent = leaves.length || '';
  } catch { /* badge is optional */ }
}

async function boot() {
  try {
    const w = await api.get('whoami');
    Me.user = w.user; Me.role = w.user.role; Me.access = new Set(w.access);
  } catch (err) {
    view.innerHTML = '';
    errorView(view, err, boot);
    return;
  }
  applyRole();
  window.addEventListener('hashchange', render);
  window.addEventListener('erp:refresh', render);
  window.addEventListener('erp:badges', refreshBadges);
  render();
  refreshBadges();
}
boot();
