// Shared helpers for the ERP API modules
import * as C from '../../../erp/js/calc.js';

export { C };

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (m) => new HttpError(400, m);
export const notFound = (m = 'Not found.') => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);
export const forbidden = (m = 'You do not have access to this.') => new HttpError(403, m);
export const methodNotAllowed = () => new HttpError(405, 'Method not allowed.');

/** Unwrap a Supabase result, translating common Postgres errors */
export function must({ data, error }) {
  if (!error) return data;
  if (error.code === '23505') throw new HttpError(409, 'Already exists: ' + (error.details || error.message));
  if (error.code === '23503') throw new HttpError(409, 'This record is linked to other records and cannot be removed.');
  if (error.code === '23514') throw bad('Invalid value: ' + error.message);
  if (error.code === 'PGRST116') throw notFound();
  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST205') {
    throw new HttpError(500, 'Database is missing ERP tables/columns. Run the latest erp_schema.sql in Supabase.');
  }
  throw new HttpError(500, error.message);
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Pick + coerce allowed fields from a request body.
 * Rules: 'text' 'num' 'int' 'date' 'bool' 'intarr' 'enum:a|b' — add '!' for required.
 */
export function clean(body, spec, { partial = false } = {}) {
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    const has = body && Object.prototype.hasOwnProperty.call(body, key);
    const required = rule.endsWith('!');
    if (!has) {
      if (!partial && required) throw bad(`${key} is required.`);
      continue;
    }
    const type = rule.replace('!', '');
    let v = body[key];
    if (v === '' || v === undefined) v = null;
    if (v === null) {
      if (required) throw bad(`${key} is required.`);
      out[key] = type === 'bool' ? false : null;
      continue;
    }
    if (type === 'text') out[key] = String(v).trim().slice(0, 4000) || null;
    else if (type === 'num') {
      const n = Number(v);
      if (!Number.isFinite(n)) throw bad(`${key} must be a number.`);
      out[key] = C.round2(n);
    } else if (type === 'int') {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n)) throw bad(`${key} must be a whole number.`);
      out[key] = n;
    } else if (type === 'date') {
      if (!DATE_RE.test(String(v))) throw bad(`${key} must be a date (YYYY-MM-DD).`);
      out[key] = String(v);
    } else if (type === 'bool') {
      out[key] = v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
    } else if (type === 'intarr') {
      out[key] = (Array.isArray(v) ? v : String(v).split(',')).map((x) => parseInt(x, 10)).filter((x) => x >= 0 && x <= 6);
    } else if (type.startsWith('enum:')) {
      const allowed = type.slice(5).split('|');
      if (!allowed.includes(String(v))) throw bad(`${key} must be one of: ${allowed.join(', ')}.`);
      out[key] = String(v);
    }
    if (required && (out[key] === null || out[key] === '')) throw bad(`${key} is required.`);
  }
  return out;
}

export const idOf = (q, key = 'id') => {
  const id = parseInt(q[key], 10);
  if (!id) throw bad(`${key} required.`);
  return id;
};

/** Today in India (servers run in UTC) */
export const today = () => C.istToday();

export const employedOn = (e, from, to) => (!e.join_date || e.join_date <= to) && (!e.exit_date || e.exit_date >= from);

export async function getSettings(sb) {
  const { data } = await sb.from('erp_settings').select('*').eq('id', 1).maybeSingle();
  if (data) return data;
  return must(await sb.from('erp_settings').insert({ id: 1 }).select('*').single());
}

/** invoiced / received / outstanding for a list of invoices (drafts & cancelled excluded) */
export function invoiceMoney(invs) {
  let invoiced = 0, received = 0, outstanding = 0;
  invs.forEach((i) => {
    if (i.status === 'cancelled' || i.status === 'draft') return;
    invoiced += Number(i.total); received += Number(i.amount_paid);
    outstanding += Number(i.total) - Number(i.amount_paid);
  });
  return { invoiced: C.round2(invoiced), received: C.round2(received), outstanding: C.round2(outstanding) };
}

/** group rows by a key into Map<key, row[]> */
export function groupBy(rows, key) {
  const m = new Map();
  rows.forEach((r) => { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}

/**
 * Salary cost of work (employee-days) per product, using salary history.
 * Returns Map<product_id, { days, cost, byEmp: Map<emp_id,{days,cost,first,last}>, byMonth: Map<month,{days,cost}> }>
 */
export async function workCost(sb, { productId = null, employeeId = null, from = null, to = null } = {}) {
  const s = await getSettings(sb);
  let aq = sb.from('erp_attendance').select('employee_id, product_id, date, status').in('status', ['present', 'half-day']);
  let tq = sb.from('erp_timesheets').select('employee_id, product_id, date, hours');
  if (employeeId) { aq = aq.eq('employee_id', employeeId); tq = tq.eq('employee_id', employeeId); }
  if (from) { aq = aq.gte('date', from); tq = tq.gte('date', from); }
  if (to) { aq = aq.lte('date', to); tq = tq.lte('date', to); }
  const [att, ts, emps, hist] = await Promise.all([
    aq.then(must), tq.then(must),
    sb.from('erp_employees').select('id, monthly_salary').then(must),
    sb.from('erp_salary_history').select('employee_id, effective_from, monthly_salary').then(must),
  ]);
  const empById = new Map(emps.map((e) => [e.id, e]));
  const histBy = groupBy(hist, 'employee_id');
  const rateCache = new Map();
  const rate = (eid, month) => {
    const k = eid + '|' + month;
    if (!rateCache.has(k)) {
      const salary = C.salaryForMonth(histBy.get(eid) || [], month, empById.get(eid)?.monthly_salary);
      rateCache.set(k, C.dailyRate(salary, month, s.weekly_off));
    }
    return rateCache.get(k);
  };
  const out = new Map();
  for (const w of C.allocateWork(att, ts)) {
    if (productId && Number(w.product_id) !== Number(productId)) continue;
    const month = w.date.slice(0, 7);
    const cost = w.days * rate(w.employee_id, month);
    if (!out.has(w.product_id)) out.set(w.product_id, { days: 0, cost: 0, byEmp: new Map(), byMonth: new Map() });
    const p = out.get(w.product_id);
    p.days += w.days; p.cost += cost;
    const be = p.byEmp.get(w.employee_id) || { days: 0, cost: 0, first: w.date, last: w.date };
    be.days += w.days; be.cost += cost;
    if (w.date < be.first) be.first = w.date;
    if (w.date > be.last) be.last = w.date;
    p.byEmp.set(w.employee_id, be);
    const bm = p.byMonth.get(month) || { days: 0, cost: 0 };
    bm.days += w.days; bm.cost += cost;
    p.byMonth.set(month, bm);
  }
  // tidy rounding
  out.forEach((p) => {
    p.days = C.round2(p.days); p.cost = C.round2(p.cost);
    p.byEmp.forEach((v) => { v.days = C.round2(v.days); v.cost = C.round2(v.cost); });
    p.byMonth.forEach((v) => { v.days = C.round2(v.days); v.cost = C.round2(v.cost); });
  });
  return out;
}
