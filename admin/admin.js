'use strict';
/* ================================================================
   UXONIC Admin Panel — Shared JavaScript
   Used by: dashboard.html, applications.html, jobs.html, contacts.html
   ================================================================ */

// ── CONFIG ───────────────────────────────────────────────────────
const ADMIN_API = '/api/admin';
const TOKEN_KEY = 'uxonic_admin_token';
const INFO_KEY  = 'uxonic_admin_info';

// ── AUTH ─────────────────────────────────────────────────────────
export const Auth = {
  getToken()  { return localStorage.getItem(TOKEN_KEY); },
  getInfo()   { try { return JSON.parse(localStorage.getItem(INFO_KEY)||'{}'); } catch { return {}; } },
  isLoggedIn(){ return !!this.getToken(); },
  save(token, admin) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(INFO_KEY, JSON.stringify(admin));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(INFO_KEY);
  },
  logout() {
    this.clear();
    window.location.href = '/admin';
  },
  requireLogin() {
    if (!this.isLoggedIn()) { window.location.href = '/admin'; }
  },
};

// ── API HELPER ────────────────────────────────────────────────────
export const API = {
  async request(path, options = {}) {
    const token = Auth.getToken();
    const res = await fetch(ADMIN_API + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) { Auth.logout(); return null; }
    return res.json();
  },
  get(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(path + (qs ? '?' + qs : ''));
  },
  post(path, body)   { return this.request(path, { method: 'POST',   body: JSON.stringify(body) }); },
  put(path,  body)   { return this.request(path, { method: 'PUT',    body: JSON.stringify(body) }); },
  delete(path)       { return this.request(path, { method: 'DELETE' }); },
  deleteQ(path, params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(path + (qs ? '?' + qs : ''), { method: 'DELETE' });
  },
};

// ── UTILITIES ─────────────────────────────────────────────────────
export function e(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return diff + 's ago';
  if (diff < 3600)   return Math.floor(diff/60)   + 'm ago';
  if (diff < 86400)  return Math.floor(diff/3600)  + 'h ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12: true });
}

export function statusBadge(status) {
  const map = {
    new:         'badge-new',
    reviewing:   'badge-reviewing',
    shortlisted: 'badge-shortlisted',
    rejected:    'badge-rejected',
    hired:       'badge-hired',
    active:      'badge-active',
    draft:       'badge-draft',
    closed:      'badge-closed',
  };
  return `<span class="badge ${map[status]||'badge-draft'}">${e(status)}</span>`;
}

export function toast(msg, type = 'success') {
  const old = document.getElementById('ux-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'ux-toast';
  const bg = type === 'success' ? '#0f5132' : type === 'error' ? '#7f1d1d' : '#78350f';
  t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);
    background:${bg};color:#fff;padding:14px 26px;border-radius:100px;font-size:.88rem;
    font-weight:600;font-family:inherit;display:flex;align-items:center;gap:10px;
    box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:99999;opacity:0;
    transition:opacity .35s ease,transform .35s ease;white-space:nowrap;pointer-events:none;`;
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
  t.innerHTML = `<i class="fas ${icon}"></i><span>${e(msg)}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
  }));
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

export function confirm_dialog(msg) {
  return window.confirm(msg);
}

// ── LAYOUT BOOTSTRAP ─────────────────────────────────────────────
export function initLayout(activePage) {
  Auth.requireLogin();
  const admin = Auth.getInfo();

  // Sidebar user info
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarUserAvatar');
  if (nameEl)   nameEl.textContent  = admin.full_name || 'Admin';
  if (roleEl)   roleEl.textContent  = admin.role      || 'admin';
  if (avatarEl) avatarEl.textContent = (admin.full_name || 'A').charAt(0).toUpperCase();

  // Active nav
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === activePage);
  });

  // Logout
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', (ev) => { ev.preventDefault(); Auth.logout(); });
  });

  // Mobile hamburger
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('open');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    });
    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // Clock
  const clock = document.getElementById('adminClock');
  if (clock) {
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }); };
    tick(); setInterval(tick, 30000);
  }
}

// ── MODAL ─────────────────────────────────────────────────────────
export const Modal = {
  open(id)  { const m = document.getElementById(id); if(m){ m.classList.add('open'); document.body.style.overflow='hidden'; } },
  close(id) { const m = document.getElementById(id); if(m){ m.classList.remove('open'); document.body.style.overflow=''; } },
  closeAll() { document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); }); document.body.style.overflow=''; },
};
document.addEventListener('keydown', e => { if(e.key==='Escape') Modal.closeAll(); });
