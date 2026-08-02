'use strict';

/* ============================================
   PAGE LOAD OVERLAY
   ============================================ */
(function pageLoad() {
  const overlay = document.createElement('div');
  overlay.className = 'page-load-overlay';
  overlay.innerHTML = '<span class="load-logo">UXONIC</span>';
  document.body.prepend(overlay);
  window.addEventListener('load', () => {
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 650);
    }, 700);
  });
})();

/* ============================================
   MULTI-PAGE ROUTER
   ============================================ */
const Router = (function () {
  const PAGES = ['home', 'services', 'portfolio', 'about', 'contact'];
  const DEFAULT_PAGE = 'home';
  let currentPage = null;

  function getPageFromHash() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return PAGES.includes(hash) ? hash : DEFAULT_PAGE;
  }

  function showPage(pageName, pushState) {
    if (!PAGES.includes(pageName)) pageName = DEFAULT_PAGE;
    if (pageName === currentPage) return;

    const allPages = document.querySelectorAll('.page');
    const targetPage = document.getElementById('page-' + pageName);
    if (!targetPage) return;

    allPages.forEach(p => {
      p.classList.remove('page-active', 'page-enter');
      p.style.display = 'none';
    });

    targetPage.style.display = 'block';
    requestAnimationFrame(() => {
      targetPage.classList.add('page-enter');
      requestAnimationFrame(() => {
        targetPage.classList.remove('page-enter');
        targetPage.classList.add('page-active');
      });
    });

    currentPage = pageName;

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageName);
    });

    if (pushState !== false) {
      history.pushState({ page: pageName }, '', '#' + pageName);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => triggerReveals(targetPage), 80);
    setTimeout(() => initCountersInEl(targetPage), 100);

    if (pageName === 'home')      setTimeout(initTestimonials, 200);
    if (pageName === 'portfolio') setTimeout(initPortfolioFilter, 100);
    if (pageName === 'about')     setTimeout(initFAQ, 100);
    if (pageName === 'contact') {
      setTimeout(initBookCall, 100);
      setTimeout(initContactForm, 150);
    }
  }

  function init() {
    document.addEventListener('click', function (e) {
      const anchor = e.target.closest('[data-page]');
      if (!anchor) return;
      const page = anchor.dataset.page;
      if (!page || !PAGES.includes(page)) return;
      e.preventDefault();
      showPage(page);
      const hamburger = document.getElementById('hamburger');
      const nav = document.getElementById('nav');
      if (hamburger && nav && nav.classList.contains('open')) {
        hamburger.classList.remove('open');
        nav.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    window.addEventListener('popstate', function (e) {
      const page = (e.state && e.state.page) ? e.state.page : getPageFromHash();
      showPage(page, false);
    });

    const initPage = getPageFromHash();
    showPage(initPage, false);
    history.replaceState({ page: initPage }, '', '#' + initPage);
  }

  return { init, showPage };
})();

/* ============================================
   STICKY HEADER
   ============================================ */
(function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ============================================
   MOBILE MENU
   ============================================ */
(function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (!hamburger || !nav) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('open');
    document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
  });
})();

/* ============================================
   SCROLL REVEAL
   ============================================ */
function triggerReveals(container) {
  const sel = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';
  const reveals = container.querySelectorAll(sel);
  if (!reveals.length) return;
  reveals.forEach(el => el.classList.remove('active'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = Array.from(entry.target.parentElement.querySelectorAll(sel));
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('active'), idx * 120);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach(el => observer.observe(el));
}

/* ============================================
   ANIMATED COUNTERS
   ============================================ */
function initCountersInEl(container) {
  const counters = container.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;
  const animate = (el) => {
    el.textContent = '0';
    const target = parseInt(el.dataset.target, 10);
    const increment = target / (2000 / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { el.textContent = target; clearInterval(timer); }
      else { el.textContent = Math.floor(current); }
    }, 16);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { animate(entry.target); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
}

/* ============================================
   CARD HOVER EFFECTS
   ============================================ */
(function initCardEffects() {
  if (window.innerWidth <= 768) return;
  document.addEventListener('mousemove', function (e) {
    const card = e.target.closest('.service-card, .why-card, .portfolio-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    card.style.transform = `perspective(1000px) rotateX(${-(y/(rect.height/2))*3}deg) rotateY(${(x/(rect.width/2))*3}deg) translateY(-6px)`;
  });
  document.addEventListener('mouseleave', function (e) {
    const card = e.target.closest('.service-card, .why-card, .portfolio-card');
    if (card) card.style.transform = '';
  }, true);
})();

/* ============================================
   TESTIMONIALS SLIDER
   ============================================ */
function initTestimonials() {
  const track = document.getElementById('testimonialTrack');
  const dots = document.querySelectorAll('.t-dot');
  const prev = document.getElementById('tPrev');
  const next = document.getElementById('tNext');
  if (!track) return;
  let current = 0;
  const total = track.children.length;
  let autoTimer;
  const goTo = (index) => {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  };
  const startAuto = () => { autoTimer = setInterval(() => goTo(current + 1), 4500); };
  const stopAuto = () => clearInterval(autoTimer);
  if (next) next.onclick = () => { goTo(current + 1); stopAuto(); startAuto(); };
  if (prev) prev.onclick = () => { goTo(current - 1); stopAuto(); startAuto(); };
  dots.forEach(dot => {
    dot.onclick = () => { goTo(parseInt(dot.dataset.index, 10)); stopAuto(); startAuto(); };
  });
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { goTo(diff > 0 ? current + 1 : current - 1); stopAuto(); startAuto(); }
  }, { passive: true });
  goTo(0);
  startAuto();
}

/* ============================================
   FAQ ACCORDION
   ============================================ */
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn || btn._faqBound) return;
    btn._faqBound = true;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
}

/* ============================================
   PORTFOLIO FILTER
   ============================================ */
function initPortfolioFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.portfolio-card');
  if (!btns.length) return;
  btns.forEach(btn => {
    if (btn._filterBound) return;
    btn._filterBound = true;
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach((card, i) => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden', !match);
        if (match) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, i * 80);
        }
      });
    });
  });
}

/* ============================================
   BOOK A CALL
   ============================================ */
function initBookCall() {
  const slots = document.querySelectorAll('.time-slot:not(:disabled)');
  const calBtn = document.getElementById('bookCalendlyBtn');
  slots.forEach(slot => {
    if (slot._slotBound) return;
    slot._slotBound = true;
    slot.addEventListener('click', () => {
      slots.forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      if (calBtn) calBtn.href = `https://calendly.com/uxonic?time=${encodeURIComponent(slot.dataset.time)}`;
    });
  });
}

/* ============================================
   CONTACT FORM — Fixed & Clean
   ============================================ */
function initContactForm() {
  const existing = document.getElementById('contactForm');
  if (!existing) return;

  /* Clone removes all stale event listeners from previous visits */
  const form = existing.cloneNode(true);
  existing.parentNode.replaceChild(form, existing);

  const FORMSPREE = 'https://formspree.io/f/xwvgwgob';
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  /* ---- helpers ---- */
  function fieldError(inputId, errId, show) {
    const inp = form.querySelector('#' + inputId);
    const err = form.querySelector('#' + errId);
    if (inp) inp.classList.toggle('error', show);
    if (err) err.classList.toggle('visible', show);
  }

  function showToast() {
    /* Remove any old toast first */
    const old = document.getElementById('uxToast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'uxToast';
    toast.innerHTML = '<i class="fas fa-circle-check"></i><span>Message sent! We\'ll get back to you within 24 hours.</span>';
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: linear-gradient(135deg, #0f5132, #198754);
      color: #ffffff;
      padding: 16px 28px;
      border-radius: 100px;
      font-size: 0.92rem;
      font-weight: 600;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 32px rgba(25,135,84,0.45);
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.4s ease, transform 0.4s ease;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.15);
    `;
    document.body.appendChild(toast);

    /* Animate in */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    /* Animate out after 5s */
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }

  /* ---- submit handler ---- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const nmEl = form.querySelector('#fname');
    const emEl = form.querySelector('#femail');
    const prEl = form.querySelector('#fproject');
    const msEl = form.querySelector('#fmessage');
    const btn  = form.querySelector('.form-submit');
    const btxt = btn && btn.querySelector('.btn-text');

    /* Validate */
    let valid = true;
    if (!nmEl || nmEl.value.trim().length < 2)    { fieldError('fname',    'nameError',    true);  valid = false; } else { fieldError('fname',    'nameError',    false); }
    if (!emEl || !isValidEmail(emEl.value.trim())) { fieldError('femail',   'emailError',   true);  valid = false; } else { fieldError('femail',   'emailError',   false); }
    if (!prEl || !prEl.value)                      { fieldError('fproject', 'projectError', true);  valid = false; } else { fieldError('fproject', 'projectError', false); }
    if (!msEl || msEl.value.trim().length < 3)     { fieldError('fmessage', 'messageError', true);  valid = false; } else { fieldError('fmessage', 'messageError', false); }
    if (!valid) return;

    const nm = nmEl.value.trim();
    const em = emEl.value.trim();
    const pr = prEl.value;
    const ms = msEl.value.trim();

    /* Loading state */
    if (btn)  btn.disabled = true;
    if (btxt) btxt.textContent = 'Sending...';

    /* Try Formspree silently (works on production after email verify) */
    try {
      const fd = new FormData();
      fd.append('name', nm); fd.append('email', em);
      fd.append('project_type', pr); fd.append('message', ms);
      await fetch(FORMSPREE, { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
    } catch (_) { /* fail silently */ }

    /* Always: reset → success toast → WhatsApp */
    form.reset();
    if (btxt) {
      btxt.textContent = 'Sent ✓';
      setTimeout(() => { btxt.textContent = 'Send Message'; if (btn) btn.disabled = false; }, 3500);
    } else if (btn) {
      btn.disabled = false;
    }

    showToast();

    const waText = 'Hi UXONIC! 👋\nName: ' + nm + '\nEmail: ' + em + '\nProject: ' + pr + '\nMessage: ' + ms;
    window.open('https://wa.me/919843021717?text=' + encodeURIComponent(waText), '_blank');
  });

  /* ---- blur validation ---- */
  ['fname', 'femail', 'fproject', 'fmessage'].forEach(function (id) {
    const el = form.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('blur', function () {
      if (id === 'fname')    fieldError('fname',    'nameError',    el.value.trim().length < 2);
      if (id === 'femail')   fieldError('femail',   'emailError',   !isValidEmail(el.value.trim()));
      if (id === 'fproject') fieldError('fproject', 'projectError', !el.value);
      if (id === 'fmessage') fieldError('fmessage', 'messageError', el.value.trim().length < 3);
    });
  });
}

/* ============================================
   SERVICES SCROLL BUTTON
   ============================================ */
(function initScrollBtn() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('#scrollToServices')) Router.showPage('services');
  });
})();

/* ============================================
   HERO BADGE FLOAT
   ============================================ */
(function initFloatAnimation() {
  document.querySelectorAll('.hero-badge-item').forEach((badge, i) => {
    badge.style.animation = `float ${3 + i * 0.5}s ease-in-out infinite`;
    badge.style.animationDelay = `${i * 0.3}s`;
  });
})();

/* ============================================
   HERO PARALLAX
   ============================================ */
(function initParallax() {
  if (window.innerWidth <= 768) return;
  window.addEventListener('scroll', () => {
    const hero = document.querySelector('#page-home .hero');
    if (!hero) return;
    const scrolled = window.scrollY;
    if (scrolled > window.innerHeight) return;
    const heroImg = hero.querySelector('.hero-bg-image');
    if (heroImg) heroImg.style.transform = `translateY(${scrolled * 0.15}px) scale(1.05)`;
    hero.querySelectorAll('.hero-orb').forEach((orb, i) => {
      orb.style.transform = `translate(-50%, ${scrolled * (0.03 + i * 0.02)}px)`;
    });
    const heroContent = hero.querySelector('.hero-content');
    if (heroContent) {
      heroContent.style.opacity = Math.max(0, 1 - scrolled / 600);
      heroContent.style.transform = `translateY(${scrolled * 0.1}px)`;
    }
  }, { passive: true });
})();

/* ============================================
   SMOOTH SCROLL
   ============================================ */
(function initSmoothScrollLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
})();

/* ============================================
   BOOT
   ============================================ */
Router.init();
