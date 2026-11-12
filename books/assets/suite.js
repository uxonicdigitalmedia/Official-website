/* UXONIC Books — product pages.
   Header, mobile menu, FAQ, pricing toggle and early-access forms.
   Scroll animations come from /assets/js/motion.js (it animates the .page.page-active element). */
(function () {
  'use strict';

  // Local preview: when the site runs on this computer, send app links to the local app (npm run dev)
  // instead of books.uxonicdigital.com, which isn't live yet. Has no effect on the real website.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    document.querySelectorAll('a[href^="https://books.uxonicdigital.com"]').forEach((a) => {
      a.href = a.href.replace('https://books.uxonicdigital.com', 'http://localhost:5173');
    });
  }

  // Sticky header
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile menu
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (hamburger && nav) {
    const close = () => { hamburger.classList.remove('open'); nav.classList.remove('open'); document.body.style.overflow = ''; };
    hamburger.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      hamburger.classList.toggle('open', open);
      nav.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach((q) => {
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const open = !item.classList.contains('open');
      item.classList.toggle('open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });

  // Pricing: monthly / yearly. Prices come from the HTML first, then from the live plans
  // table (edited in Admin → UXONIC Books → Plans), so a price change needs no redeploy.
  const inrFmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const cycles = [];
  document.querySelectorAll('[data-cycle]').forEach((wrap) => {
    const btns = wrap.querySelectorAll('.cycle button');
    let current = 'monthly';
    const set = (cycle) => {
      current = cycle;
      btns.forEach((b) => b.classList.toggle('on', b.dataset.v === cycle));
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cycle)));
      wrap.querySelectorAll('[data-month]').forEach((el) => {
        const m = Number(el.dataset.month);
        const y = Number(el.dataset.year || m * 10);
        el.querySelector('b').textContent = inrFmt(cycle === 'yearly' ? y / 12 : m);
        el.querySelector('span').textContent = cycle === 'yearly' ? '/ month, billed ' + inrFmt(y) + ' yearly' : '/ month';
      });
    };
    btns.forEach((b) => b.addEventListener('click', () => set(b.dataset.v)));
    set('monthly');
    cycles.push(() => set(current));
  });

  const cfg = window.UXONIC_BOOKS;
  if (cfg && cfg.supabaseUrl && cfg.publishableKey && document.querySelector('[data-plan]')) {
    fetch(cfg.supabaseUrl + '/rest/v1/plans?select=code,kind,price_monthly_paise,price_yearly_paise,max_users,max_contacts&is_active=eq.true', {
      headers: { apikey: cfg.publishableKey, Authorization: 'Bearer ' + cfg.publishableKey },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((plans) => {
        if (!Array.isArray(plans) || plans.length === 0) return;
        const byCode = Object.fromEntries(plans.map((p) => [p.code, p]));
        document.querySelectorAll('[data-plan]').forEach((el) => {
          const p = byCode[el.dataset.plan];
          if (!p) { el.hidden = true; return; } // retired plan
          const amt = el.matches('[data-month]') ? el : el.querySelector('[data-month]');
          if (amt) { amt.dataset.month = String(p.price_monthly_paise / 100); amt.dataset.year = String(p.price_yearly_paise / 100); }
          const users = el.querySelector('[data-f="users"]');
          if (users) { users.textContent = String(p.max_users); users.nextElementSibling.textContent = p.max_users === 1 ? 'user' : 'users'; }
          const contacts = el.querySelector('[data-f="contacts"]');
          if (contacts) contacts.textContent = p.max_contacts.toLocaleString('en-IN');
        });
        cycles.forEach((redraw) => redraw());
      })
      .catch(() => { /* keep the prices printed in the page */ });
  }

  // Early-access forms → existing /api/contact endpoint (stored in Supabase + emailed to the team)
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  document.querySelectorAll('form[data-waitlist]').forEach((form) => {
    const status = form.querySelector('.qf-status');
    const btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
      const name = v('name'), email = v('email');
      form.elements.name.classList.toggle('error', name.length < 2);
      form.elements.email.classList.toggle('error', !isEmail(email));
      if (name.length < 2 || !isEmail(email)) {
        status.className = 'qf-status bad';
        status.textContent = 'Please enter your name and a valid email.';
        return;
      }
      const lines = [
        'Early access request — UXONIC Books',
        'Interested in: ' + (v('module') || form.dataset.waitlist),
        v('company') && 'Business: ' + v('company'),
        v('team') && 'Team size: ' + v('team'),
        v('phone') && 'Phone: ' + v('phone'),
        v('note') && 'Note: ' + v('note'),
      ].filter(Boolean);
      btn.disabled = true;
      status.className = 'qf-status';
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name, email,
            project_type: 'UXONIC Books — ' + (v('module') || form.dataset.waitlist),
            message: lines.join('\n'),
            website: v('website'),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
        form.reset();
        status.className = 'qf-status ok';
        status.textContent = "You're on the list. We'll email you when your workspace is ready.";
      } catch (err) {
        status.className = 'qf-status bad';
        status.textContent = err && err.message && err.message !== 'Failed to fetch'
          ? err.message
          : 'Could not send right now. Please message us on WhatsApp.';
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
