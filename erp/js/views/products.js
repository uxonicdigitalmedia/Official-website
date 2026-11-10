import { api, esc, money, fdate, fmonth, num, badge, pageHead, empty, formModal, toast, toastErr, canEdit } from '../core.js';
import { renderBoard, taskForm } from './tasks.js';

const KINDS = [['product', 'UXONIC product'], ['app', 'App'], ['client-project', 'Client project'], ['internal', 'Internal']];
const STATUS = [['planning', 'Planning'], ['active', 'Active'], ['on-hold', 'On hold'], ['completed', 'Completed']];
const kindLabel = (k) => KINDS.find(([v]) => v === k)?.[1] || k;

async function editProduct(p, onDone) {
  const { clients } = await api.get('clients');
  formModal({
    title: p ? `Edit ${p.name}` : 'Add product / app / project',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. MyHelpBro app' },
      { name: 'kind', label: 'Type', type: 'select', options: KINDS, blank: false, default: 'product' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS, blank: false, default: 'active' },
      { name: 'client_id', label: 'Client (for client projects)', type: 'select', options: clients.map((c) => [c.id, c.company || c.name]), blank: '— None (own product) —' },
      { name: 'start_date', label: 'Start date', type: 'date' },
      { name: 'end_date', label: 'End / deadline', type: 'date' },
      { name: 'budget', label: 'Budget (₹)', type: 'number', step: '0.01', hint: 'Optional — compared with salary cost' },
      { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 3 },
    ],
    values: p || {},
    submitLabel: p ? 'Save changes' : 'Add',
    onSubmit: async (v) => {
      const r = p ? await api.put('products', p.id, v) : await api.post('products', v);
      toast(r.message);
      onDone && onDone(r.product);
    },
  });
}

export async function productsList(root, _p, _q, alive) {
  const { products } = await api.get('products');
  if (!alive()) return;
  let filter = 'open';
  const draw = () => {
    const rows = products.filter((p) => filter === 'all' || (filter === 'open' ? p.status !== 'completed' : p.status === 'completed'));
    root.innerHTML = `
      ${pageHead('Products & Apps', 'UXONIC products, apps and client projects — who works on them, for how many days, and what it costs',
        '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> Add product</button>')}
      <div class="toolbar"><div class="seg-tabs">${[['open', 'In progress'], ['completed', 'Completed'], ['all', 'All']].map(([f, l]) => `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${rows.length ? `<div class="cards">${rows.map((p) => {
        const profit = p.received - p.cost - (p.expenses || 0);
        const budgetPct = p.budget ? Math.min(100, (p.cost / p.budget) * 100) : null;
        return `
        <a class="pcard" href="#/products/${p.id}">
          <div class="pcard-top"><span class="pcard-kind">${esc(kindLabel(p.kind))}</span>${badge(p.status)}</div>
          <h3>${esc(p.name)}</h3>
          <p class="muted">${esc(p.erp_clients?.name || 'Own product')}</p>
          <div class="pcard-stats">
            <div><span>People</span><b>${p.people || p.members}</b></div>
            <div><span>Days</span><b>${num(p.days)}</b></div>
            <div><span>Salary cost</span><b>${money(p.cost)}</b></div>
            <div><span>Received</span><b>${money(p.received)}</b></div>
          </div>
          ${p.progress?.total ? `<small class="muted">Tasks ${p.progress.done}/${p.progress.total} done</small><div class="meter"><span style="width:${p.progress.pct}%"></span></div>` : ''}
          ${budgetPct != null ? `<div class="meter" title="Cost vs budget"><span style="width:${budgetPct}%" class="${budgetPct >= 100 ? 'over' : ''}"></span></div><small class="muted">${money(p.cost)} of ${money(p.budget)} budget</small>` : ''}
          ${p.received || p.cost ? `<div class="pcard-profit ${profit < 0 ? 't-red' : 't-green'}">${profit < 0 ? 'Loss' : 'Profit'} ${money(Math.abs(profit))}</div>` : ''}
        </a>`;
      }).join('')}</div>`
      : empty('fa-cubes', products.length ? 'Nothing here.' : 'No products yet. Add your apps, products and client projects to track team effort and cost.',
        products.length ? '' : '<button class="btn btn-primary" id="add2">Add first product</button>')}`;
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    const add = () => editProduct(null, (p) => { location.hash = '#/products/' + p.id; });
    root.querySelector('#add').addEventListener('click', add);
    root.querySelector('#add2')?.addEventListener('click', add);
  };
  draw();
}

export async function productDetail(root, [id], _q, alive) {
  const [d, { employees }] = await Promise.all([api.get('products', { id }), api.get('employees')]);
  if (!alive()) return;
  const p = d.product, t = d.totals;
  const maxMonth = Math.max(1, ...d.monthly.map((m) => m.days));
  const refresh = () => dispatchEvent(new Event('erp:refresh'));

  root.innerHTML = `
    ${pageHead(p.name, `${esc(kindLabel(p.kind))} ${badge(p.status)} ${p.erp_clients ? `· <a class="link" href="#/clients/${p.erp_clients.id}">${esc(p.erp_clients.company || p.erp_clients.name)}</a>` : ''}`,
      `<a class="btn btn-ghost" href="#/products"><i class="fas fa-arrow-left"></i> Back</a>
       <button class="btn btn-ghost danger" id="del" aria-label="Delete"><i class="fas fa-trash"></i></button>
       <button class="btn btn-ghost" id="edit"><i class="fas fa-pen"></i> Edit</button>
       <a class="btn btn-primary" href="#/invoices/new?product=${p.id}${p.client_id ? '&client=' + p.client_id : ''}"><i class="fas fa-file-invoice"></i> Invoice</a>`)}

    <div class="stats">
      <div class="stat"><span class="stat-label">Team</span><span class="stat-val">${d.team.length}</span></div>
      <div class="stat"><span class="stat-label">Days worked</span><span class="stat-val">${num(t.days)}</span></div>
      <div class="stat"><span class="stat-label">Salary cost</span><span class="stat-val">${money(t.cost)}</span>${p.budget ? `<span class="stat-sub">of ${money(p.budget)} budget</span>` : ''}</div>
      <div class="stat"><span class="stat-label">Invoiced</span><span class="stat-val">${money(t.invoiced)}</span></div>
      <div class="stat"><span class="stat-label">Received</span><span class="stat-val">${money(t.received)}</span></div>
      <div class="stat"><span class="stat-label">Other expenses</span><span class="stat-val">${money(t.expenses)}</span></div>
      <div class="stat"><span class="stat-label">${t.profit < 0 ? 'Loss' : 'Profit'} (received − salaries − expenses)</span><span class="stat-val ${t.profit < 0 ? 't-red' : 't-green'}">${money(Math.abs(t.profit))}</span></div>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>Team &amp; effort</h2><button class="btn btn-ghost btn-sm" id="addMember"><i class="fas fa-user-plus"></i> Add member</button></div>
      ${d.team.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Employee</th><th>Role</th><th class="r">Monthly salary</th><th class="r">Days worked</th><th>Period</th><th class="r">Salary cost</th><th></th></tr></thead>
        <tbody>${d.team.map((m) => `<tr>
          <td><a href="#/employees/${m.employee_id}" class="person"><span class="avatar sm">${esc((m.full_name || '?').charAt(0))}</span><div><b>${esc(m.full_name)}</b><small>${esc(m.emp_code)} · ${esc(m.designation || '')}</small></div></a></td>
          <td>${esc(m.role || '—')}${m.is_member ? '' : '<small class="block muted">not on team list</small>'}</td>
          <td class="r">${money(m.monthly_salary)}</td>
          <td class="r"><b>${num(m.days)}</b></td>
          <td>${m.first ? `${fdate(m.first)} → ${fdate(m.last)}` : '—'}</td>
          <td class="r">${money(m.cost)}</td>
          <td class="r">${m.is_member ? `<button class="icon-btn" data-rm="${m.employee_id}" title="Remove from team" aria-label="Remove"><i class="fas fa-user-minus"></i></button>` : ''}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="r">${num(t.days)}</td><td></td><td class="r">${money(t.cost)}</td><td></td></tr></tfoot>
      </table></div>` : empty('fa-users', 'No one on this team yet. Add members, then pick this product in daily attendance.')}
      <p class="muted small mt">Days come from attendance ("Worked on") or timesheet hours. Cost = days × that month's daily rate (salary for that month ÷ working days).</p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Tasks <small class="muted">${d.progress.done}/${d.progress.total} done</small></h2>
        ${canEdit('tasks') ? '<button class="btn btn-ghost btn-sm" id="addTask"><i class="fas fa-plus"></i> Add task</button>' : ''}</div>
      ${d.progress.total ? `<div class="meter mb"><span style="width:${d.progress.pct}%"></span></div>` : ''}
      <div id="board"></div>
      <p class="muted small mt">Client-visible tasks and milestones show up as progress in the client portal.</p>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Effort by month</h2></div>
        ${d.monthly.length ? `<div class="bars">${d.monthly.map((m) => `
          <div class="bar-row"><span class="bar-name">${fmonth(m.month)}</span><span class="bar-track"><span class="bar-fill" style="width:${(m.days / maxMonth) * 100}%"></span></span><span class="bar-val">${num(m.days)} d · ${money(m.cost)}</span></div>`).join('')}</div>`
          : empty('fa-chart-column', 'No work logged yet.')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Invoices</h2></div>
        ${d.invoices.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Invoice</th><th>Date</th><th class="r">Total</th><th>Status</th></tr></thead>
          <tbody>${d.invoices.map((i) => `<tr class="click" data-href="#/invoices/${i.id}"><td><b>${esc(i.invoice_no)}</b></td><td>${fdate(i.issue_date)}</td><td class="r">${money(i.total)}</td><td>${badge(i.effective_status)}</td></tr>`).join('')}</tbody>
        </table></div>` : empty('fa-file-invoice', 'No invoices linked to this product.')}
      </section>
    </div>
    ${d.expenses.length ? `<section class="panel"><div class="panel-head"><h2>Expenses for this product</h2><a class="link" href="#/expenses">Expenses <i class="fas fa-arrow-right"></i></a></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th class="r">Amount (excl. GST)</th></tr></thead>
      <tbody>${d.expenses.map((x) => `<tr><td>${fdate(x.date)}</td><td>${esc(x.category)}</td><td>${esc(x.vendor || '—')}</td><td class="r">${money(Number(x.amount) - Number(x.gst_amount))}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    ${p.description ? `<section class="panel"><div class="panel-head"><h2>About</h2></div><p class="pre">${esc(p.description)}</p></section>` : ''}`;

  renderBoard(root.querySelector('#board'), d.tasks, { products: [], employees, productId: p.id, onChange: refresh });
  root.querySelector('#addTask')?.addEventListener('click', () => taskForm(null, { products: [], employees, productId: p.id, onSaved: refresh }));

  root.querySelector('#edit').addEventListener('click', () => editProduct(p, refresh));
  root.querySelector('#del').addEventListener('click', async () => {
    if (!confirm(`Delete ${p.name}? Attendance stays, but it will no longer be linked to this product.`)) return;
    try { const r = await api.del('products', { id: p.id }); toast(r.message); location.hash = '#/products'; } catch (err) { toastErr(err); }
  });
  root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', async () => {
    try { await api.del('members', { product_id: p.id, employee_id: b.dataset.rm }); toast('Removed from team.'); refresh(); } catch (err) { toastErr(err); }
  }));
  root.querySelector('#addMember').addEventListener('click', async () => {
    const { employees } = await api.get('employees');
    const onTeam = new Set(d.team.filter((m) => m.is_member).map((m) => m.employee_id));
    const options = employees.filter((e) => e.status === 'active' && !onTeam.has(e.id));
    if (!options.length) { toast('All active employees are already on this team.', 'warn'); return; }
    formModal({
      title: `Add to ${p.name}`, wide: false, submitLabel: 'Add to team',
      fields: [
        { name: 'employee_id', label: 'Employee', type: 'select', required: true, options: options.map((e) => [e.id, `${e.full_name} (${e.designation || e.emp_code})`]), blank: '— Select —' },
        { name: 'role', label: 'Role on this product', placeholder: 'e.g. Flutter developer' },
      ],
      onSubmit: async (v) => { await api.post('members', { product_id: p.id, ...v }); toast('Added to team.'); refresh(); },
    });
  });
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
}
