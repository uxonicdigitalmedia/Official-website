// ================================================================
// UXONIC ERP — shared front-end helpers
// ================================================================
import { inr, parseYmd } from './calc.js';

// Each app keeps its own token. The staff ERP also accepts the admin-panel token (owner).
const APPS = {
  staff: { keys: ['uxonic_erp_token', 'uxonic_admin_token'], info: 'uxonic_erp_info', login: '/erp/login' },
  employee: { keys: ['uxonic_emp_token'], info: 'uxonic_emp_info', login: '/erp/me' },
  client: { keys: ['uxonic_client_token'], info: 'uxonic_client_info', login: '/erp/client' },
};
let app = APPS.staff;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const Auth = {
  use(kind) { app = APPS[kind]; },
  token: () => app.keys.map((k) => ls.get(k)).find(Boolean) || null,
  save(token, info) { ls.set(app.keys[0], token); ls.set(app.info, JSON.stringify(info || {})); },
  info() { try { return JSON.parse(ls.get(app.info) || ls.get('uxonic_admin_info') || '{}'); } catch { return {}; } },
  logout(redirect = true) {
    app.keys.forEach(ls.del); ls.del(app.info);
    if (redirect) location.href = app.login;
  },
};

// ---------------- API ----------------
async function request(method, resource, params = {}, body) {
  const qs = new URLSearchParams({ r: resource, ...params }).toString();
  const res = await fetch('/api/erp?' + qs, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(Auth.token() ? { Authorization: 'Bearer ' + Auth.token() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !resource.startsWith('auth-')) { Auth.logout(); throw new Error('Session expired. Please log in again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
export const api = {
  get: (r, params) => request('GET', r, params),
  post: (r, body, params) => request('POST', r, params, body),
  put: (r, id, body) => request('PUT', r, id != null ? { id } : {}, body),
  del: (r, params) => request('DELETE', r, params),
};

// ---------------- formatting ----------------
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const money = (n) => inr(n);
export function fdate(s) {
  if (!s) return '—';
  return parseYmd(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmonth(m) {
  const [y, mo] = String(m).slice(0, 7).split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
export const num = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

const BADGE = {
  active: 'green', inactive: 'grey', paid: 'green', draft: 'grey', sent: 'blue', 'partially-paid': 'amber',
  overdue: 'red', cancelled: 'grey', planning: 'violet', 'on-hold': 'amber', completed: 'green',
  present: 'green', 'half-day': 'amber', absent: 'red', leave: 'blue', holiday: 'violet',
};
export const badge = (s, label) => `<span class="badge badge-${BADGE[s] || 'grey'}">${esc(label || String(s || '').replace('-', ' '))}</span>`;

// ---------------- toast ----------------
export function toast(msg, type = 'ok') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.setAttribute('role', 'status');
  t.innerHTML = `<i class="fas ${type === 'ok' ? 'fa-circle-check' : type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'}"></i><span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, type === 'warn' ? 6500 : 3500);
}
export const toastErr = (e) => toast(e?.message || String(e), 'err');

// ---------------- modal ----------------
export function modal({ title, body, footer = '', wide = false, onOpen }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close"><i class="fas fa-xmark"></i></button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const first = wrap.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 50);
  onOpen && onOpen(wrap);
  return { el: wrap, close };
}

// ---------------- forms ----------------
/**
 * fields: [{ name, label, type, options:[[value,label]], required, span, placeholder, step, hint }]
 */
export function formHtml(fields, values = {}) {
  return `<div class="form-grid">${fields.map((f) => {
    if (f.type === 'section') return `<div class="form-section span-2">${esc(f.label)}</div>`;
    const v = values[f.name] ?? f.default ?? '';
    const id = 'f_' + f.name;
    const req = f.required ? 'required' : '';
    const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.name}" ${req}>${f.blank !== false ? `<option value="">${esc(f.blank || '—')}</option>` : ''}${
        (f.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} ${ph}>${esc(v)}</textarea>`;
    } else if (f.type === 'weekdays') {
      const sel = new Set((v || []).map(Number));
      input = `<div class="chips-input">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) =>
        `<label class="chip-check"><input type="checkbox" name="${f.name}" value="${i}" ${sel.has(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>`;
    } else {
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${ph} ${f.step ? `step="${f.step}"` : ''} ${f.type === 'number' ? 'inputmode="decimal"' : ''}>`;
    }
    return `<div class="field ${f.span === 2 ? 'span-2' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' <b>*</b>' : ''}</label>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
  }).join('')}</div>`;
}

export function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'section') continue;
    if (f.type === 'weekdays') {
      out[f.name] = [...root.querySelectorAll(`input[name="${f.name}"]:checked`)].map((i) => Number(i.value));
      continue;
    }
    const el = root.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    out[f.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return out;
}

/** Open a form in a modal; onSubmit(values) may throw to keep the modal open */
export function formModal({ title, fields, values, submitLabel = 'Save', onSubmit, wide = true }) {
  const m = modal({
    title, wide,
    body: `<form id="mform" novalidate>${formHtml(fields, values)}</form>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" form="mform" type="submit">${esc(submitLabel)}</button>`,
  });
  const form = m.el.querySelector('#mform');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !form.querySelector(`[name="${f.name}"]`)?.value.trim());
    if (missing) { toast(`${missing.label} is required.`, 'err'); form.querySelector(`[name="${missing.name}"]`)?.focus(); return; }
    const btn = m.el.querySelector('button[type="submit"]');
    btn.disabled = true;
    try { await onSubmit(readForm(form, fields)); m.close(); }
    catch (err) { toastErr(err); }
    finally { btn.disabled = false; }
  });
  return m;
}

// ---------------- page chrome ----------------
export function pageHead(title, sub = '', actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
}
export const empty = (icon, text, action = '') =>
  `<div class="empty"><i class="fas ${icon}"></i><p>${esc(text)}</p>${action}</div>`;
export const spinner = () => '<div class="loading"><span class="spin"></span>Loading…</div>';

export function errorView(root, err, retry) {
  root.innerHTML = `<div class="empty"><i class="fas fa-plug-circle-xmark"></i><p>${esc(err.message)}</p>${retry ? '<button class="btn btn-ghost" id="retry">Try again</button>' : ''}</div>`;
  root.querySelector('#retry')?.addEventListener('click', retry);
}

/** Download rows as CSV */
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const go = (hash) => { location.hash = hash; };

// ---------------- signed-in staff member + role checks ----------------
const WRITE = {
  admin: null, // everything
  hr: ['employees', 'attendance', 'timesheets', 'leaves', 'advances', 'payroll', 'products', 'members', 'tasks'],
  accountant: ['payroll', 'products', 'members', 'tasks', 'clients', 'invoices', 'payments', 'quotes', 'recurring', 'expenses'],
};
export const Me = { user: null, role: 'admin', access: new Set() };
export const canView = (r) => Me.role === 'admin' || Me.access.has(r);
export const canEdit = (r) => Me.role === 'admin' || (WRITE[Me.role] || []).includes(r);

/** WhatsApp share link (Indian numbers without a country code get +91) */
export function waLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
