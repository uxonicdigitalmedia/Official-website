// Products / apps / client projects, team members, tasks (kanban)
import { C, must, clean, bad, idOf, invoiceMoney, workCost, methodNotAllowed } from './core.js';

const PRODUCT_SPEC = {
  name: 'text!', kind: 'enum:product|app|client-project|internal', client_id: 'int',
  status: 'enum:planning|active|on-hold|completed', start_date: 'date', end_date: 'date',
  budget: 'num', description: 'text',
};

export function taskProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export async function products({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const id = idOf(q);
      const [product, members, invs, emps, expenses, tasks] = await Promise.all([
        sb.from('erp_products').select('*, erp_clients(id, name, company)').eq('id', id).single().then(must),
        sb.from('erp_product_members').select('employee_id, role, added_at').eq('product_id', id).then(must),
        sb.from('erp_invoices').select('id, invoice_no, issue_date, total, amount_paid, status, due_date').eq('product_id', id).order('issue_date', { ascending: false }).then(must),
        sb.from('erp_employees').select('id, emp_code, full_name, designation, monthly_salary, status').then(must),
        sb.from('erp_expenses').select('*').eq('product_id', id).order('date', { ascending: false }).then(must),
        sb.from('erp_tasks').select('*, erp_employees(full_name)').eq('product_id', id).order('due_date').then(must),
      ]);
      const w = (await workCost(sb, { productId: id })).get(id) || { days: 0, cost: 0, byEmp: new Map(), byMonth: new Map() };
      const empById = new Map(emps.map((e) => [e.id, e]));
      const memberIds = new Set(members.map((m) => m.employee_id));
      const team = [...new Set([...memberIds, ...w.byEmp.keys()])].map((eid) => {
        const e = empById.get(eid) || {};
        const be = w.byEmp.get(eid) || { days: 0, cost: 0 };
        const m = members.find((x) => x.employee_id === eid);
        return {
          employee_id: eid, emp_code: e.emp_code, full_name: e.full_name, designation: e.designation,
          monthly_salary: e.monthly_salary, role: m?.role || null, is_member: memberIds.has(eid),
          days: be.days, cost: be.cost, first: be.first || null, last: be.last || null,
        };
      }).sort((a, b) => b.days - a.days);
      invs.forEach((i) => { i.effective_status = C.invoiceStatus(i); });
      const money = invoiceMoney(invs);
      const expTotal = C.round2(expenses.reduce((t, x) => t + Number(x.amount) - Number(x.gst_amount), 0));
      return {
        product, team, invoices: invs, expenses, tasks, progress: taskProgress(tasks),
        monthly: [...w.byMonth.entries()].map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
        totals: {
          days: w.days, cost: w.cost, expenses: expTotal, ...money,
          profit: C.round2(money.received - w.cost - expTotal),
        },
      };
    }
    const [list, members, invs, expenses, tasks] = await Promise.all([
      sb.from('erp_products').select('*, erp_clients(name)').order('status').order('name').then(must),
      sb.from('erp_product_members').select('product_id').then(must),
      sb.from('erp_invoices').select('product_id, total, amount_paid, status').not('product_id', 'is', null).then(must),
      sb.from('erp_expenses').select('product_id, amount, gst_amount').not('product_id', 'is', null).then(must),
      sb.from('erp_tasks').select('product_id, status').then(must),
    ]);
    const w = await workCost(sb);
    list.forEach((p) => {
      const ws = w.get(p.id) || { days: 0, cost: 0, byEmp: new Map() };
      p.members = members.filter((m) => m.product_id === p.id).length;
      p.days = ws.days; p.cost = ws.cost; p.people = ws.byEmp.size;
      p.expenses = C.round2(expenses.filter((x) => x.product_id === p.id).reduce((t, x) => t + Number(x.amount) - Number(x.gst_amount), 0));
      p.progress = taskProgress(tasks.filter((t) => t.product_id === p.id));
      Object.assign(p, invoiceMoney(invs.filter((i) => i.product_id === p.id)));
    });
    return { products: list };
  }
  if (method === 'POST') {
    const p = must(await sb.from('erp_products').insert(clean(body, PRODUCT_SPEC)).select('*').single());
    return { product: p, message: 'Product added.' };
  }
  if (method === 'PUT') {
    const p = must(await sb.from('erp_products').update(clean(body, PRODUCT_SPEC, { partial: true })).eq('id', idOf(q)).select('*').single());
    return { product: p, message: 'Product updated.' };
  }
  if (method === 'DELETE') {
    must(await sb.from('erp_products').delete().eq('id', idOf(q)));
    return { message: 'Product deleted. Attendance history is kept (unlinked).' };
  }
  throw methodNotAllowed();
}

export async function members({ sb, method, q, body }) {
  if (method === 'POST') {
    const row = clean(body, { product_id: 'int!', employee_id: 'int!', role: 'text' });
    must(await sb.from('erp_product_members').upsert(row, { onConflict: 'product_id,employee_id' }));
    return { message: 'Team member saved.' };
  }
  if (method === 'DELETE') {
    const product_id = parseInt(q.product_id, 10), employee_id = parseInt(q.employee_id, 10);
    if (!product_id || !employee_id) throw bad('product_id and employee_id required.');
    must(await sb.from('erp_product_members').delete().eq('product_id', product_id).eq('employee_id', employee_id));
    return { message: 'Removed from team.' };
  }
  throw methodNotAllowed();
}

export const TASK_SPEC = {
  product_id: 'int!', title: 'text!', description: 'text', assignee_id: 'int',
  status: 'enum:todo|doing|review|done', priority: 'enum:low|medium|high', due_date: 'date',
  is_milestone: 'bool', client_visible: 'bool',
};

export async function tasks({ sb, method, q, body }) {
  if (method === 'GET') {
    let query = sb.from('erp_tasks').select('*, erp_employees(full_name), erp_products(name)').order('due_date');
    if (q.product_id) query = query.eq('product_id', parseInt(q.product_id, 10));
    if (q.assignee_id) query = query.eq('assignee_id', parseInt(q.assignee_id, 10));
    if (q.open === '1') query = query.neq('status', 'done');
    return { tasks: must(await query) };
  }
  if (method === 'POST') {
    const row = clean(body, TASK_SPEC);
    const t = must(await sb.from('erp_tasks').insert(row).select('*').single());
    return { task: t, message: 'Task added.' };
  }
  if (method === 'PUT') {
    const t = must(await sb.from('erp_tasks').update(clean(body, TASK_SPEC, { partial: true })).eq('id', idOf(q)).select('*').single());
    return { task: t, message: 'Task updated.' };
  }
  if (method === 'DELETE') {
    must(await sb.from('erp_tasks').delete().eq('id', idOf(q)));
    return { message: 'Task deleted.' };
  }
  throw methodNotAllowed();
}
