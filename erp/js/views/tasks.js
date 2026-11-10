import { api, esc, fdate, pageHead, empty, formModal, toast, toastErr, canEdit } from '../core.js';
import { ymd } from '../calc.js';

const COLS = [['todo', 'To do'], ['doing', 'In progress'], ['review', 'Review'], ['done', 'Done']];
const PRI = { high: 'badge-red', medium: 'badge-amber', low: 'badge-grey' };

export function taskForm(task, { products, employees, productId, onSaved }) {
  formModal({
    title: task ? 'Edit task' : 'New task', submitLabel: task ? 'Save' : 'Add task',
    values: task || { product_id: productId, status: 'todo', priority: 'medium', client_visible: true },
    fields: [
      { name: 'title', label: 'Task', required: true, span: 2, placeholder: 'e.g. Build checkout page' },
      ...(productId ? [] : [{ name: 'product_id', label: 'Product / project', type: 'select', required: true, blank: '— Select —', options: products.map((p) => [p.id, p.name]) }]),
      { name: 'assignee_id', label: 'Assigned to', type: 'select', blank: '— Unassigned —', options: employees.filter((e) => e.status === 'active').map((e) => [e.id, e.full_name]) },
      { name: 'due_date', label: 'Due date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', blank: false, options: COLS },
      { name: 'priority', label: 'Priority', type: 'select', blank: false, options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
      { name: 'is_milestone', label: 'Milestone (shown to client)', type: 'select', blank: false, options: [['false', 'No'], ['true', 'Yes — milestone']] },
      { name: 'client_visible', label: 'Visible in client portal', type: 'select', blank: false, options: [['true', 'Yes'], ['false', 'No — internal']] },
      { name: 'description', label: 'Details', type: 'textarea', span: 2, rows: 3 },
    ],
    onSubmit: async (v) => {
      const body = { ...v, product_id: productId || v.product_id, is_milestone: v.is_milestone === 'true', client_visible: v.client_visible !== 'false' };
      const r = task ? await api.put('tasks', task.id, body) : await api.post('tasks', body);
      toast(r.message); onSaved && onSaved();
    },
  });
}

/** Kanban board. Drag a card (or use its menu on touch) to change status. */
export function renderBoard(el, tasks, { products, employees, productId, showProduct = false, onChange }) {
  const can = canEdit('tasks');
  const today = ymd(new Date());
  el.innerHTML = `<div class="board">${COLS.map(([k, label]) => {
    const list = tasks.filter((t) => t.status === k);
    return `<div class="col" data-col="${k}"><div class="col-head"><b>${label}</b><span>${list.length}</span></div>
      <div class="col-body">${list.map((t) => `
        <article class="tcard ${t.status !== 'done' && t.due_date && t.due_date < today ? 'late' : ''}" draggable="${can}" data-id="${t.id}">
          <div class="tcard-top"><span class="badge ${PRI[t.priority]}">${t.priority}</span>${t.is_milestone ? '<span class="badge badge-violet"><i class="fas fa-flag"></i> milestone</span>' : ''}${!t.client_visible ? '<i class="fas fa-eye-slash muted" title="Internal"></i>' : ''}</div>
          <b>${esc(t.title)}</b>
          ${showProduct && t.erp_products ? `<small class="muted">${esc(t.erp_products.name)}</small>` : ''}
          <div class="tcard-foot"><span>${t.erp_employees ? `<span class="avatar xs">${esc(t.erp_employees.full_name.charAt(0))}</span> ${esc(t.erp_employees.full_name)}` : '<span class="muted">Unassigned</span>'}</span>
            ${t.due_date ? `<span class="${t.status !== 'done' && t.due_date < today ? 't-red' : 'muted'}">${fdate(t.due_date)}</span>` : ''}</div>
          ${can ? `<select class="tmove" aria-label="Move task">${COLS.map(([v, l]) => `<option value="${v}" ${v === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
        </article>`).join('') || '<p class="col-empty">—</p>'}</div></div>`;
  }).join('')}</div>`;
  if (!can) return;
  const move = async (id, status) => {
    try { await api.put('tasks', id, { status }); onChange(); } catch (err) { toastErr(err); }
  };
  el.querySelectorAll('.tcard').forEach((card) => {
    card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.querySelector('.tmove').addEventListener('change', (e) => move(card.dataset.id, e.target.value));
    card.querySelector('.tmove').addEventListener('click', (e) => e.stopPropagation());
    card.addEventListener('click', () => taskForm(tasks.find((t) => String(t.id) === card.dataset.id), { products, employees, productId, onSaved: onChange }));
  });
  el.querySelectorAll('.col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain');
      const t = tasks.find((x) => String(x.id) === id);
      if (t && t.status !== col.dataset.col) move(id, col.dataset.col);
    });
  });
}

export async function tasksView(root, _p, query, alive) {
  const params = { ...(query.product ? { product_id: query.product } : {}), ...(query.person ? { assignee_id: query.person } : {}) };
  const [{ tasks }, { products }, { employees }] = await Promise.all([api.get('tasks', params), api.get('products'), api.get('employees')]);
  if (!alive()) return;
  const today = ymd(new Date());
  const late = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length;
  root.innerHTML = `
    ${pageHead('Tasks', `${tasks.filter((t) => t.status !== 'done').length} open${late ? ` · <span class="t-red">${late} overdue</span>` : ''}`,
      canEdit('tasks') ? '<button class="btn btn-primary" id="add"><i class="fas fa-plus"></i> New task</button>' : '')}
    <div class="toolbar">
      <select id="fp" class="pill-select" aria-label="Filter by product"><option value="">All products</option>${products.map((p) => `<option value="${p.id}" ${String(p.id) === query.product ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select id="fe" class="pill-select" aria-label="Filter by person"><option value="">Everyone</option>${employees.filter((e) => e.status === 'active').map((e) => `<option value="${e.id}" ${String(e.id) === query.person ? 'selected' : ''}>${esc(e.full_name)}</option>`).join('')}</select>
    </div>
    ${products.length ? '<div id="board"></div>' : empty('fa-cubes', 'Create a product first, then add tasks to it.', '<a class="btn btn-primary" href="#/products">Products</a>')}`;
  const refresh = () => dispatchEvent(new Event('erp:refresh'));
  if (products.length) renderBoard(root.querySelector('#board'), tasks, { products, employees, showProduct: true, onChange: refresh });
  const filter = () => {
    const p = root.querySelector('#fp').value, e = root.querySelector('#fe').value;
    location.hash = '#/tasks?' + new URLSearchParams({ ...(p ? { product: p } : {}), ...(e ? { person: e } : {}) });
  };
  root.querySelector('#fp').addEventListener('change', filter);
  root.querySelector('#fe').addEventListener('change', filter);
  root.querySelector('#add')?.addEventListener('click', () => taskForm(null, { products, employees, productId: query.product || null, onSaved: refresh }));
}
