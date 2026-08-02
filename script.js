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
   SCROLL REVEAL (Enhanced with multiple types)
   Supports: .reveal, .reveal-left, .reveal-right,
   .reveal-scale, .reveal-stagger
   ============================================ */
function triggerReveals(container) {
  const revealSelectors = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';
  const reveals = container.querySelectorAll(revealSelectors);
  if (!reveals.length) return;

  // Reset
  reveals.forEach(el => {
    el.classList.remove('active');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = Array.from(entry.target.parentElement.querySelectorAll(revealSelectors));
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('active'), idx * 120);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => observer.observe(el));
}

/* ============================================
   ANIMATED COUNTERS (per-container)
   Numbers animate counting up from 0 to
   final value when scrolled into view
   ============================================ */
function initCountersInEl(container) {
  const counters = container.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;

  const animate = (el) => {
    el.textContent = '0';
    const target = parseInt(el.dataset.target, 10);
    const duration = 2000; // 2 seconds
    const step = 16;
    const totalSteps = duration / step;
    const increment = target / totalSteps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current);
      }
    }, step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

/* ============================================
   CARD HOVER EFFECTS
   Smooth translateY lift on hover with
   perspective tilt for desktop
   ============================================ */
(function initCardEffects() {
  if (window.innerWidth <= 768) return;
  
  document.addEventListener('mousemove', function (e) {
    const card = e.target.closest('.service-card, .why-card, .portfolio-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -(y / (rect.height / 2)) * 3;
    const rotateY = (x / (rect.width / 2)) * 3;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
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
   CONTACT FORM
   ============================================ */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  // Replace with clone to remove any old listeners
  const freshForm = form.cloneNode(true);
  form.parentNode.replaceChild(freshForm, form);

  const FORMSPREE_URL = 'https://formspree.io/f/xwvgwgob';
  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

  function showErr(id, errId, show) {
    const inp = freshForm.querySelector('#' + id);
    const err = freshForm.querySelector('#' + errId);
    if (inp) inp.classList.toggle('error', show);
    if (err) err.classList.toggle('visible', show);
  }

  function showSuccess() {
    const successEl = freshForm.querySelector('#formSuccess');
    if (!successEl) return;
    successEl.style.display = 'flex';
    successEl.style.opacity = '1';
    successEl.classList.add('show');
    setTimeout(() => {
      successEl.classList.remove('show');
      successEl.style.display = '';
      successEl.style.opacity = '';
    }, 6000);
  }

  function openWhatsApp(nameVal, emailVal, projectVal, msgVal) {
    const wa = encodeURIComponent(
      'Hi UXONIC! \uD83D\uDC4B\nName: ' + nameVal +
      '\nEmail: ' + emailVal +
      '\nProject: ' + projectVal +
      '\nMessage: ' + msgVal
    );
    window.open('https://wa.me/919843021717?text=' + wa, '_blank');
  }

  freshForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();

    const nameEl    = freshForm.querySelector('#fname');
    const emailEl   = freshForm.querySelector('#femail');
    const projectEl = freshForm.querySelector('#fproject');
    const msgEl     = freshForm.querySelector('#fmessage');
    const btn       = freshForm.querySelector('.form-submit');
    const btnTxt    = btn ? btn.querySelector('.btn-text') : null;

    // --- Validate ---
    let valid = true;
    if (!nameEl    || nameEl.value.trim().length < 2)        { showErr('fname',    'nameError',    true);  valid = false; } else { showErr('fname',    'nameError',    false); }
    if (!emailEl   || !validateEmail(emailEl.value.trim()))  { showErr('femail',   'emailError',   true);  valid = false; } else { showErr('femail',   'emailError',   false); }
    if (!projectEl || !projectEl.value)                      { showErr('fproject', 'projectError', true);  valid = false; } else { showErr('fproject', 'projectError', false); }
    if (!msgEl     || msgEl.value.trim().length < 3)         { showErr('fmessage', 'messageError', true);  valid = false; } else { showErr('fmessage', 'messageError', false); }
    if (!valid) return;

    const nameVal    = nameEl.value.trim();
    const emailVal   = emailEl.value.trim();
    const projectVal = projectEl.value;
    const msgVal     = msgEl.value.trim();

    if (btn)    btn.disabled = true;
    if (btnTxt) btnTxt.textContent = 'Sending...';

    // --- Localhost: skip Formspree, open WhatsApp directly ---
    if (isLocalhost) {
      freshForm.reset();
      if (btnTxt) btnTxt.textContent = 'Send Message';
      if (btn)    btn.disabled = false;
      showSuccess();
      openWhatsApp(nameVal, emailVal, projectVal, msgVal);
      return;
    }

    // --- Production: try Formspree ---
    try {
      const fd = new FormData();
      fd.append('name',         nameVal);
      fd.append('email',        emailVal);
      fd.append('project_type', projectVal);
      fd.append('message',      msgVal);

      const res  = await fetch(FORMSPREE_URL, { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
      const data = await res.json().catch(() => ({}));

      freshForm.reset();
      if (btnTxt) { btnTxt.textContent = 'Sent \u2713'; setTimeout(() => { btnTxt.textContent = 'Send Message'; }, 3000); }
      if (btn)    setTimeout(() => { btn.disabled = false; }, 3000);
      showSuccess();

      // Also open WhatsApp if Formspree not verified yet
      if (!res.ok || !data.ok) {
        openWhatsApp(nameVal, emailVal, projectVal, msgVal);
      }
    } catch (err) {
      freshForm.reset();
      if (btnTxt) btnTxt.textContent = 'Send Message';
      if (btn)    btn.disabled = false;
      showSuccess();
      openWhatsApp(nameVal, emailVal, projectVal, msgVal);
    }
  });

  // Blur validation
  ['fname','femail','fproject','fmessage'].forEach(function(id) {
    const el = freshForm.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('blur', function() {
      if (id === 'fname')    showErr('fname',    'nameError',    el.value.trim().length < 2);
      if (id === 'femail')   showErr('femail',   'emailError',   !validateEmail(el.value.trim()));
      if (id === 'fproject') showErr('fproject', 'projectError', !el.value);
      if (id === 'fmessage') showErr('fmessage', 'messageError', el.value.trim().length < 3);
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
   HERO PARALLAX (subtle)
   ============================================ */
(function initParallax() {
  if (window.innerWidth <= 768) return;
  window.addEventListener('scroll', () => {
    const hero = document.querySelector('#page-home .hero');
    if (!hero) return;
    const scrolled = window.scrollY;
    if (scrolled > window.innerHeight) return;
    
    // Subtle parallax on hero image
    const heroImg = hero.querySelector('.hero-bg-image');
    if (heroImg) {
      heroImg.style.transform = `translateY(${scrolled * 0.15}px) scale(1.05)`;
    }

    // Subtle parallax on hero orbs
    const orbs = hero.querySelectorAll('.hero-orb');
    orbs.forEach((orb, i) => {
      const speed = 0.03 + i * 0.02;
      orb.style.transform = `translate(-50%, ${scrolled * speed}px)`;
    });

    // Fade out hero content on scroll
    const heroContent = hero.querySelector('.hero-content');
    if (heroContent) {
      const opacity = Math.max(0, 1 - scrolled / 600);
      heroContent.style.opacity = opacity;
      heroContent.style.transform = `translateY(${scrolled * 0.1}px)`;
    }
  }, { passive: true });
})();

/* ============================================
   SMOOTH SCROLL BEHAVIOR ENHANCEMENT
   ============================================ */
(function initSmoothScrollLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

/* ============================================
   NAVBAR ACTIVE STATE ON SCROLL
   (For sections within the same page)
   ============================================ */
(function initScrollSpy() {
  // Only relevant for home page with multiple sections
  // Other pages are separate
})();

/* ============================================
   BOOT
   ============================================ */
Router.init();
initContactForm();
