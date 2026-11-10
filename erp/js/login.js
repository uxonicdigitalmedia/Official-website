// Email + one-time-code login used by the staff ERP and both portals
import { api, Auth, esc, toast, toastErr } from './core.js';

export function renderLogin(root, { kind, title, subtitle, onSuccess }) {
  let email = '';
  const step1 = () => {
    root.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <div class="auth-brand"><span class="brand-chip lg"><img src="/images/nav-logo-sm.png" alt=""></span><div><b>UXONIC</b><small>${esc(title)}</small></div></div>
        <h1>Sign in</h1><p class="muted">${esc(subtitle)}</p>
        <form id="f1" class="stack mt" novalidate>
          <div class="field"><label for="em">Email address</label><input id="em" type="email" autocomplete="email" inputmode="email" required value="${esc(email)}" placeholder="you@company.com"></div>
          <button class="btn btn-primary btn-block" type="submit"><i class="fas fa-paper-plane"></i> Send login code</button>
        </form>
      </div></div>`;
    const f = root.querySelector('#f1');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      email = f.querySelector('#em').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address.', 'err'); return; }
      const b = f.querySelector('button'); b.disabled = true;
      try { const r = await api.post('auth-send', { kind, email }); toast(r.message); step2(); }
      catch (err) { toastErr(err); b.disabled = false; }
    });
  };
  const step2 = () => {
    root.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <div class="auth-brand"><span class="brand-chip lg"><img src="/images/nav-logo-sm.png" alt=""></span><div><b>UXONIC</b><small>${esc(title)}</small></div></div>
        <h1>Enter your code</h1><p class="muted">If <b>${esc(email)}</b> has access, a 6-digit code was emailed to it.</p>
        <form id="f2" class="stack mt" novalidate>
          <div class="field"><label for="otp">6-digit code</label><input id="otp" class="otp-in" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required placeholder="••••••"></div>
          <button class="btn btn-primary btn-block" type="submit"><i class="fas fa-right-to-bracket"></i> Sign in</button>
          <button class="btn btn-ghost btn-block" type="button" id="back">Use a different email</button>
        </form>
      </div></div>`;
    const f = root.querySelector('#f2');
    const otp = f.querySelector('#otp');
    otp.focus();
    otp.addEventListener('input', () => { otp.value = otp.value.replace(/\D/g, '').slice(0, 6); if (otp.value.length === 6) f.requestSubmit(); });
    root.querySelector('#back').addEventListener('click', step1);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (otp.value.length !== 6) { toast('Enter all 6 digits.', 'err'); return; }
      const b = f.querySelector('button[type="submit"]'); b.disabled = true;
      try {
        const r = await api.post('auth-verify', { kind, email, otp: otp.value });
        Auth.save(r.token, { full_name: r.profile.name, email: r.profile.email, role: r.profile.role });
        document.querySelectorAll('.toast').forEach((t) => t.remove());
        onSuccess(r.profile);
      } catch (err) { toastErr(err); b.disabled = false; otp.select(); }
    });
  };
  step1();
}
