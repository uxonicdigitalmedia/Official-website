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

    // Hide current page
    allPages.forEach(p => {
      p.classList.remove('page-active', 'page-enter');
      p.style.display = 'none';
    });

    // Show new page with animation
    targetPage.style.display = 'block';
    requestAnimationFrame(() => {
      targetPage.classList.add('page-enter');
      requestAnimationFrame(() => {
        targetPage.classList.remove('page-enter');
        targetPage.classList.add('page-active');
      });
    });

    currentPage = pageName;

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === pageName);
    });

    // Update URL hash
    if (pushState !== false) {
      history.pushState({ page: pageName }, '', '#' + pageName);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Re-trigger reveal animations for the new page
    setTimeout(() => triggerReveals(targetPage), 80);

    // Re-init counters for the new page
    setTimeout(() => initCountersInEl(targetPage), 100);

    // Re-init testimonials if on home page
    if (pageName === 'home') {
      setTimeout(initTestimonials, 200);
    }

    // Re-init portfolio filter if on portfolio page
    if (pageName === 'portfolio') {
      setTimeout(initPortfolioFilter, 100);
    }

    // Re-init FAQ if on about page
    if (pageName === 'about') {
      setTimeout(initFAQ, 100);
    }

    // Re-init book call if on contact page
    if (pageName === 'contact') {
      setTimeout(initBookCall, 100);
      setTimeout(initContactForm, 100);
    }
  }

  function init() {
    // Handle all data-page links
    document.addEventListener('click', function (e) {
      const anchor = e.target.closest('[data-page]');
      if (!anchor) return;

      const page = anchor.dataset.page;
      if (!page || !PAGES.includes(page)) return;

      e.preventDefault();
      showPage(page);

      // Close mobile menu if open
      const hamburger = document.getElementById('hamburger');
      const nav = document.getElementById('nav');
      if (hamburger && nav && nav.classList.contains('open')) {
        hamburger.classList.remove('open');
        nav.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', function (e) {
      const page = (e.state && e.state.page) ? e.state.page : getPageFromHash();
      showPage(page, false);
    });

    // Load correct page on init
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
   SCROLL REVEAL (per-element, page-aware)
   ============================================ */
function triggerReveals(container) {
  const reveals = container.querySelectorAll('.reveal');
  if (!reveals.length) return;

  // Reset
  reveals.forEach(el => {
    el.classList.remove('active');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal'));
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('active'), idx * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  reveals.forEach(el => observer.observe(el));
}

/* ============================================
   ANIMATED COUNTERS (per-container)
   ============================================ */
function initCountersInEl(container) {
  const counters = container.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;

  const animate = (el) => {
    el.textContent = '0';
    const target = parseInt(el.dataset.target, 10);
    const step = 16;
    const increment = target / (1800 / step);
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { el.textContent = target; clearInterval(timer); }
      else { el.textContent = Math.floor(current); }
    }, step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { animate(entry.target); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

/* ============================================
   CARD HOVER TILT
   ============================================ */
(function initCardEffects() {
  if (window.innerWidth <= 768) return;
  document.addEventListener('mousemove', function (e) {
    const card = e.target.closest('.service-card, .why-card, .portfolio-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    card.style.transform = `perspective(800px) rotateX(${-(y / (rect.height / 2)) * 4}deg) rotateY(${(x / (rect.width / 2)) * 4}deg) translateY(-4px)`;
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
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
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
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden', !match);
        if (match) card.style.animation = 'fadeInUp 0.4s ease forwards';
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
   CONTACT FORM
   ============================================ */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form || form._formBound) return;
  form._formBound = true;

  const showError = (inputId, errorId, show) => {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.toggle('error', show);
    if (error) error.classList.toggle('visible', show);
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    const name = document.getElementById('fname');
    const email = document.getElementById('femail');
    const project = document.getElementById('fproject');
    const message = document.getElementById('fmessage');

    if (!name || name.value.trim().length < 2) { showError('fname', 'nameError', true); valid = false; } else { showError('fname', 'nameError', false); }
    if (!email || !validateEmail(email.value.trim())) { showError('femail', 'emailError', true); valid = false; } else { showError('femail', 'emailError', false); }
    if (!project || !project.value) { showError('fproject', 'projectError', true); valid = false; } else { showError('fproject', 'projectError', false); }
    if (!message || message.value.trim().length < 10) { showError('fmessage', 'messageError', true); valid = false; } else { showError('fmessage', 'messageError', false); }

    if (valid) {
      const submitBtn = form.querySelector('.form-submit');
      const successEl = document.getElementById('formSuccess');
      submitBtn.disabled = true;
      submitBtn.querySelector('.btn-text').textContent = 'Sending...';
      setTimeout(() => {
        form.reset();
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = 'Send Message';
        if (successEl) { successEl.classList.add('show'); setTimeout(() => successEl.classList.remove('show'), 5000); }
      }, 1200);
    }
  });

  ['fname', 'femail', 'fproject', 'fmessage'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (id === 'fname') showError('fname', 'nameError', el.value.trim().length < 2);
      if (id === 'femail') showError('femail', 'emailError', !validateEmail(el.value.trim()));
      if (id === 'fproject') showError('fproject', 'projectError', !el.value);
      if (id === 'fmessage') showError('fmessage', 'messageError', el.value.trim().length < 10);
    });
  });
}

/* ============================================
   SERVICES → SCROLL BUTTON
   ============================================ */
(function initScrollBtn() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('#scrollToServices')) {
      Router.showPage('services');
    }
  });
})();

/* ============================================
   HERO BADGE FLOAT ANIMATION
   ============================================ */
(function initFloatAnimation() {
  const badges = document.querySelectorAll('.hero-badge-item');
  badges.forEach((badge, i) => {
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
    const heroImage = hero.querySelector('.hero-main-image');
    if (heroImage) heroImage.style.transform = `scale(${1 + scrolled * 0.0003})`;
    const statCard = hero.querySelector('.hero-stat-card');
    if (statCard) statCard.style.transform = `translateY(${scrolled * -0.08}px)`;
    const badges = hero.querySelector('.hero-badges');
    if (badges) badges.style.transform = `translateY(${scrolled * 0.05}px)`;
  }, { passive: true });
})();

/* ============================================
   BOOT
   ============================================ */
Router.init();
