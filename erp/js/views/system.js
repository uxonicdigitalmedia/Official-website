import { api, esc, fdate, badge, pageHead, empty, formModal, toast, toastErr, downloadCsv } from '../core.js';

const ROLES = [
  ['admin', 'Admin — everything, incl. settings, roles, audit'],
  ['hr', 'HR — employees, attendance, leave, timesheets, payroll, advances, tasks'],
  ['accountant', 'Accounts — clients, quotations, invoices, recurring, expenses, reports, GST, payroll'],
];

export async function usersView(root, _p, _q, alive) {
  const { users } = await api.get('users');
  if (!alive()) return;
  const edit = (u) => formModal({
    title: u ? `Edit ${u.full_name}` : 'Add team member', submitLabel: u ? 'Save' : 'Add', values: u ? { ...u, active: String(u.active) } : { role: 'hr', active: 'true' },
    fields: [
      { name: 'full_name', label: 'Name', required: true },
      { name: 'email', label: 'Email (used to sign in)', type: 'email', required: true },
      { name: 'role', label: 'Role', type: 'select', blank: false, options: ROLES, span: 2 },
      { name: 'active', label: 'Access', type: 'select', blank: false, options: [['true', 'Active'], ['false', 'Disabled']] },
    ],
    onSubmit: async (v) => {
      const body = { ...v, active: v.active !== 'false' };
      const r = u ? await api.put('users', u.id, body) : await api.post('users', body);
      toast(r.message); dispatchEvent(new Event('erp:refresh'));
    },
  });
  root.innerHTML = `
    ${pageHead('Team & roles', 'People who can sign in to the ERP at <b>/erp/login</b> with a one-time email code',
      '<button class="btn btn-primary" id="add"><i class="fas fa-user-plus"></i> Add member</button>')}
    <div class="alert alert-info"><i class="fas fa-circle-info"></i><div>You (the owner) always have admin access through the website admin login. Employees use <b>/erp/me</b> and clients use <b>/erp/client</b> — they don't need to be added here.</div></div>
    ${users.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr><td><b>${esc(u.full_name)}</b></td><td>${esc(u.email)}</td>
        <td>${badge(u.role === 'admin' ? 'planning' : u.role === 'hr' ? 'sent' : 'active', u.role === 'hr' ? 'HR' : u.role)}</td>
        <td>${u.last_login ? fdate(u.last_login.slice(0, 10)) : '<span class="muted">never</span>'}</td>
        <td>${badge(u.active ? 'active' : 'inactive', u.active ? 'active' : 'disabled')}</td>
        <td class="r nowrap"><button class="icon-btn" data-edit="${u.id}" aria-label="Edit"><i class="fas fa-pen"></i></button><button class="icon-btn" data-del="${u.id}" aria-label="Remove"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody>
    </table></div>` : empty('fa-user-shield', 'Only you have access right now. Add your HR or accountant so they get just the parts they need.')}
    <section class="panel mt"><div class="panel-head"><h2>What each role can do</h2></div>
      <ul class="list">${ROLES.map(([r, d]) => `<li><b class="cap">${r === 'hr' ? 'HR' : r}</b> — ${esc(d.split('— ')[1])}</li>`).join('')}</ul></section>`;
  root.querySelector('#add').addEventListener('click', () => edit(null));
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(users.find((u) => String(u.id) === b.dataset.edit))));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Remove this person\'s ERP access?')) return;
    try { const r = await api.del('users', { id: b.dataset.del }); toast(r.message); dispatchEvent(new Event('erp:refresh')); } catch (err) { toastErr(err); }
  }));
}

const RES_LABEL = { auth: 'Sign-in', cron: 'Automation' };
export async function auditView(root, _p, query, alive) {
  const { entries } = await api.get('audit', query.resource ? { resource: query.resource } : {});
  if (!alive()) return;
  const resources = [...new Set(entries.map((e) => e.resource))].sort();
  const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  root.innerHTML = `
    ${pageHead('Audit log', 'Every change and sign-in — who did what, and when (latest 300)', '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export</button>')}
    <div class="toolbar"><select id="res" class="pill-select" aria-label="Filter"><option value="">Everything</option>${resources.map((r) => `<option value="${r}" ${r === query.resource ? 'selected' : ''}>${esc(RES_LABEL[r] || r)}</option>`).join('')}</select></div>
    ${entries.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Area</th><th>Details</th></tr></thead>
      <tbody>${entries.map((e) => `<tr><td class="nowrap">${when(e.created_at)}</td><td><b>${esc(e.actor)}</b><small class="block muted">${esc(e.actor_role || '')}</small></td>
        <td><span class="badge ${e.action.startsWith('DELETE') ? 'badge-red' : e.action === 'login' ? 'badge-blue' : e.action.startsWith('POST') ? 'badge-green' : 'badge-amber'}">${esc(e.action.toLowerCase())}</span></td>
        <td>${esc(RES_LABEL[e.resource] || e.resource)}${e.record_id ? ` <span class="muted">#${esc(e.record_id)}</span>` : ''}</td><td>${esc(e.summary || '')}</td></tr>`).join('')}</tbody>
    </table></div>` : empty('fa-clock-rotate-left', 'Nothing logged yet.')}`;
  root.querySelector('#res').addEventListener('change', (e) => { location.hash = '#/audit' + (e.target.value ? '?resource=' + e.target.value : ''); });
  root.querySelector('#csv').addEventListener('click', () => downloadCsv('uxonic-audit-log.csv', [
    ['When', 'Who', 'Role', 'Action', 'Area', 'Record', 'Details', 'IP'],
    ...entries.map((e) => [e.created_at, e.actor, e.actor_role, e.action, e.resource, e.record_id, e.summary, e.ip]),
  ]));
}
