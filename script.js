'use strict';

/* PAGE LOAD */
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

/* STICKY HEADER */
(function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  window.addEventListener('scroll', () => { header.classList.toggle('scrolled', window.scrollY > 40); }, { passive: true });
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 100;
    sections.forEach(section => {
      if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + section.id) link.classList.add('active');
        });
      }
    });
  }, { passive: true });
})();

/* MOBILE MENU */
(function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  if (!hamburger || !nav) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('open');
    document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
  });
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      nav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
})();

/* SMOOTH SCROLL */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
  });
  
  // Scroll to services button
  const scrollBtn = document.getElementById('scrollToServices');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      const services = document.getElementById('services');
      if (services) {
        window.scrollTo({ top: services.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
      }
    });
  }
})();

/* SCROLL REVEAL */
(function initReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal'));
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => { entry.target.classList.add('active'); }, idx * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach(el => observer.observe(el));
})();

/* ANIMATED COUNTERS */
(function initCounters() {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;
  const animate = (el) => {
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
    entries.forEach(entry => { if (entry.isIntersecting) { animate(entry.target); observer.unobserve(entry.target); } });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
})();

/* CARD HOVER EFFECTS */
(function initCardEffects() {
  if (window.innerWidth <= 768) return;
  document.querySelectorAll('.service-card, .why-card, .portfolio-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      card.style.transform = `perspective(800px) rotateX(${-(y / (rect.height / 2)) * 4}deg) rotateY(${(x / (rect.width / 2)) * 4}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

/* TESTIMONIALS SLIDER */
(function initTestimonials() {
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
  if (next) next.addEventListener('click', () => { goTo(current + 1); stopAuto(); startAuto(); });
  if (prev) prev.addEventListener('click', () => { goTo(current - 1); stopAuto(); startAuto(); });
  dots.forEach(dot => { dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index, 10)); stopAuto(); startAuto(); }); });
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { goTo(diff > 0 ? current + 1 : current - 1); stopAuto(); startAuto(); }
  }, { passive: true });
  startAuto();
})();

/* FAQ ACCORDION */
(function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); });
      if (!isOpen) { item.classList.add('open'); item.querySelector('.faq-question').setAttribute('aria-expanded', 'true'); }
    });
  });
})();

/* PORTFOLIO FILTER */
(function initPortfolioFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.portfolio-card');
  if (!btns.length) return;
  btns.forEach(btn => {
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
})();

/* BOOK A CALL */
(function initBookCall() {
  const slots = document.querySelectorAll('.time-slot:not(:disabled)');
  const calBtn = document.getElementById('bookCalendlyBtn');
  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      slots.forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      if (calBtn) calBtn.href = `https://calendly.com/uxonic?time=${encodeURIComponent(slot.dataset.time)}`;
    });
  });
})();

/* CONTACT FORM */
(function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
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
  ['fname','femail','fproject','fmessage'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (id === 'fname') showError('fname', 'nameError', el.value.trim().length < 2);
      if (id === 'femail') showError('femail', 'emailError', !validateEmail(el.value.trim()));
      if (id === 'fproject') showError('fproject', 'projectError', !el.value);
      if (id === 'fmessage') showError('fmessage', 'messageError', el.value.trim().length < 10);
    });
  });
})();

/* HERO PARALLAX - Light version */
(function initParallax() {
  const hero = document.querySelector('.hero');
  if (!hero || window.innerWidth <= 768) return;
  window.addEventListener('scroll', () => {
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

/* HERO BADGE FLOAT ANIMATION */
(function initFloatAnimation() {
  const badges = document.querySelectorAll('.hero-badge-item');
  badges.forEach((badge, i) => {
    badge.style.animation = `float ${3 + i * 0.5}s ease-in-out infinite`;
    badge.style.animationDelay = `${i * 0.3}s`;
  });
})();
