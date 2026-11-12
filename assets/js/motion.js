/* ==========================================================
   UXONIC — scroll-driven motion
   GSAP 3 + ScrollTrigger on native scroll. Works with the hash router in
   script.js: every time a page is shown ("ux:page" event) the
   animations for that page are torn down and rebuilt.
   If the CDN scripts fail to load, the page simply renders static.
   ========================================================== */
(function () {
  'use strict';

  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const hasGSAP = !!(gsap && ST);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => window.innerWidth <= 860;
  const EASE = 'power4.out'; // ≈ cubic-bezier(0.22, 1, 0.36, 1)

  /* ---------------- Static DOM prep (runs even without GSAP) ---------------- */

  // Testimonials: duplicate cards so the CSS marquee loops seamlessly
  (function cloneMarquee() {
    const track = document.getElementById('quotes');
    if (!track || track.dataset.cloned) return;
    Array.from(track.children).forEach((card) => {
      const c = card.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    track.dataset.cloned = '1';
  })();

  // Toolkit bubbles: [x%, y%, size (% of block width), icon, lime?]
  (function buildBubbles() {
    const wrap = document.getElementById('bubbles');
    if (!wrap || wrap.children.length) return;
    const B = [
      [6, 14, 9, 'fab fa-react'], [17, 46, 6, ''], [8, 80, 11, 'fab fa-figma'], [22, 88, 5, ''],
      [26, 14, 6, 'fab fa-node-js'], [36, 92, 7, 'fab fa-wordpress'], [44, 6, 4, ''],
      [56, 92, 5, '', true], [63, 8, 7, 'fab fa-shopify'], [72, 86, 9, 'fab fa-android'],
      [80, 18, 10, 'fab fa-apple'], [93, 12, 6, ''], [90, 46, 7, 'fab fa-python'],
      [94, 80, 9, 'fab fa-aws'], [83, 62, 4, '', true], [15, 26, 4, ''], [3, 50, 5, 'fab fa-html5'],
      [50, 96, 3, ''], [30, 66, 4, 'fab fa-js'], [70, 34, 3, ''], [12, 64, 3, '', true],
      [86, 96, 4, 'fab fa-git-alt'], [40, 30, 3, ''], [60, 70, 3, '']
    ];
    const frag = document.createDocumentFragment();
    B.forEach(([x, y, s, icon, lime]) => {
      const b = document.createElement('span');
      b.className = 'bubble' + (lime ? ' is-lime' : '');
      b.style.cssText = `left:${x}%;top:${y}%;width:${s}%;aspect-ratio:1;--s:${s}`;
      if (icon) b.innerHTML = `<i class="${icon}"></i>`;
      frag.appendChild(b);
    });
    wrap.appendChild(frag);
  })();

  /* ---------------- Quick contact form (home) ---------------- */
  (function quickForm() {
    const form = document.getElementById('quickForm');
    if (!form) return;
    const status = document.getElementById('qStatus');
    const btn = form.querySelector('button[type="submit"]');
    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      form.name.classList.toggle('error', name.length < 2);
      form.email.classList.toggle('error', !isEmail(email));
      form.message.classList.toggle('error', message.length < 3);
      if (name.length < 2 || !isEmail(email) || message.length < 3) {
        status.className = 'qf-status bad';
        status.textContent = 'Please fill in your name, a valid email and a short message.';
        return;
      }
      btn.disabled = true;
      status.className = 'qf-status';
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name, email, message, project_type: 'other', website: form.website.value })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
        form.reset();
        status.className = 'qf-status ok';
        status.textContent = "Thanks! We'll get back to you within 24 hours.";
      } catch (err) {
        status.className = 'qf-status bad';
        status.textContent = (err && err.message && err.message !== 'Failed to fetch')
          ? err.message
          : 'Could not send right now. Please message us on WhatsApp.';
      } finally {
        btn.disabled = false;
      }
    });
  })();

  /* ---------------- Without GSAP: stop here (static page) ---------------- */
  if (!hasGSAP) {
    window.__uxScrollTop = () => window.scrollTo(0, 0);
    return;
  }

  gsap.registerPlugin(ST);
  // Don't re-measure everything when the mobile URL bar shows/hides (causes jumps)
  ST.config({ ignoreMobileResize: true });

  /* ---------------- Scrolling ----------------
     Native scrolling on purpose: a JS smooth-scroll library (Lenis) delays the
     page behind the wheel/trackpad, which feels like lag — especially on Mac
     trackpads and Safari that already have their own inertia. */
  window.__uxScrollTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  /* ---------------- Custom cursor ---------------- */
  if (finePointer && !reduce) {
    const cur = document.querySelector('.cursor');
    if (cur) {
      const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3.out' });
      const yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3.out' });
      window.addEventListener('mousemove', (e) => {
        cur.classList.add('on');
        xTo(e.clientX); yTo(e.clientY);
      }, { passive: true });
      document.addEventListener('mouseleave', () => cur.classList.remove('on'));
      document.addEventListener('mouseover', (e) => {
        cur.classList.toggle('big', !!e.target.closest('a, button, input, textarea, select, .faq-question'));
      });
    }
  }

  /* ---------------- Header intro (once) ---------------- */
  // clearProps: a leftover transform would trap the fixed mobile menu inside the header
  gsap.from('.header-container', { y: -40, opacity: 0, duration: 1.1, ease: EASE, delay: 0.5, clearProps: 'transform,opacity' });

  /* ---------------- Helpers ---------------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = p;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = '1';
  }

  const rand = (min, max) => min + Math.random() * (max - min);
  const glow = document.querySelector('.glow-layer');

  let ctx = null;
  let firstRun = true;
  let lastMobile = isMobile();

  /* ---------------- Per-page setup ---------------- */
  function setupPage(page) {
    if (!page) return;
    if (ctx) ctx.revert();

    page.querySelectorAll('[data-split]').forEach(splitWords);

    if (reduce) { firstRun = false; ST.refresh(); return; }

    const mobile = isMobile();

    ctx = gsap.context(() => {

      /* ---- Hero (home) ---- */
      const hero = page.querySelector('.hero');
      if (hero) {
        const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
        tl.from(hero.querySelector('[data-hero="eyebrow"]'), { y: 20, opacity: 0, duration: 0.9 })
          .from(hero.querySelectorAll('.hero-title .wi'), { yPercent: 115, duration: 1.2, stagger: 0.08 }, 0.1)
          .from(hero.querySelector('[data-hero="device"]'), { scale: 0.8, opacity: 0, filter: 'blur(10px)', duration: 1.6, clearProps: 'filter' }, 0.35)
          .from(hero.querySelectorAll('[data-hero="sub"], [data-hero="ctas"]'), { y: 24, opacity: 0, duration: 1, stagger: 0.1 }, 0.7);

        if (firstRun && document.readyState !== 'complete') {
          window.addEventListener('load', () => gsap.delayedCall(0.45, () => tl.play()), { once: true });
        } else {
          tl.play(firstRun ? 0 : undefined);
        }

        // Slow bobbing
        // (animate the wrapper — .device itself carries the CSS isometric transform)
        const bob = gsap.fromTo(hero.querySelector('.device-float'), { y: 10 }, { y: -10, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        ST.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? bob.resume() : bob.pause()) });

        // Mouse parallax tilt ±8°
        if (finePointer) {
          const floatEl = hero.querySelector('.device-float');
          gsap.set(floatEl, { transformPerspective: 1000 });
          const rx = gsap.quickTo(floatEl, 'rotationX', { duration: 0.8, ease: 'power3.out' });
          const ry = gsap.quickTo(floatEl, 'rotationY', { duration: 0.8, ease: 'power3.out' });
          const onMove = (e) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            ry(nx * 16); rx(-ny * 16);
          };
          window.addEventListener('mousemove', onMove, { passive: true });
          // removed when the context is reverted
          return () => window.removeEventListener('mousemove', onMove);
        }
      }
    });

    // Second context block (the hero block above may return early with a cleanup fn)
    ctx.add(() => {
      const hero = page.querySelector('.hero');
      if (hero) {
        gsap.to(hero.querySelector('.device-stage'), {
          yPercent: -18, ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
        });
      }

      /* ---- Section headings: masked word reveal ---- */
      page.querySelectorAll('[data-split]').forEach((el) => {
        if (el.closest('.hero')) return;
        gsap.from(el.querySelectorAll('.wi'), {
          yPercent: 115, duration: 1.1, ease: EASE, stagger: 0.06,
          scrollTrigger: { trigger: el, start: 'top 88%' }
        });
      });
      page.querySelectorAll('.sec-dot').forEach((el) => {
        gsap.from(el, { scale: 0, duration: 0.8, ease: 'back.out(3)', scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
      page.querySelectorAll('[data-fade]').forEach((el) => {
        gsap.from(el, { y: 30, opacity: 0, duration: 1.1, ease: EASE, scrollTrigger: { trigger: el, start: 'top 90%' } });
      });

      /* ---- Generic stagger groups ---- */
      page.querySelectorAll('[data-stagger]').forEach((group) => {
        gsap.from(group.children, {
          y: 50, opacity: 0, duration: 1.1, ease: EASE, stagger: 0.09,
          scrollTrigger: { trigger: group, start: 'top 85%' }
        });
      });

      /* ---- Rise-in cards ---- */
      page.querySelectorAll('[data-rise]').forEach((el) => {
        gsap.from(el, {
          y: 90, scale: 0.95, opacity: 0, duration: 1.3, ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 88%' }
        });
      });

      /* ---- Scattered feature cards fly up into place ---- */
      page.querySelectorAll('[data-scatter]').forEach((grid) => {
        const cards = Array.from(grid.children);
        if (mobile) {
          gsap.from(cards, { y: 60, opacity: 0, duration: 1, ease: EASE, stagger: 0.1, scrollTrigger: { trigger: grid, start: 'top 85%' } });
          return;
        }
        cards.forEach((card, i) => {
          gsap.fromTo(card,
            { y: 220 + i * 70, x: rand(-40, 40), rotation: rand(-12, 12), opacity: 0 },
            {
              y: 0, x: 0, rotation: 0, opacity: 1, ease: 'none',
              scrollTrigger: { trigger: grid, start: 'top 100%', end: `top ${52 - i * 6}%`, scrub: 0.3 }
            });
        });
      });

      /* ---- Comparison table ---- */
      const compare = page.querySelector('[data-compare]');
      if (compare) {
        const best = compare.querySelector('.c-best');
        const tl = gsap.timeline({ scrollTrigger: { trigger: compare, start: 'top 78%' }, defaults: { ease: EASE } });
        tl.from(best, { x: mobile ? 30 : 90, scale: 0.9, opacity: 0, duration: 1.3 });
        const cols = compare.querySelectorAll('.compare-col');
        const rowCount = cols[0].querySelectorAll('.c-row').length;
        for (let r = 0; r < rowCount; r++) {
          const row = Array.from(cols).map((c) => c.querySelectorAll('.c-row')[r]);
          tl.from(row, { y: 18, opacity: 0, duration: 0.7 }, 0.35 + r * 0.12);
        }
      }

      /* ---- Horizontal pinned scroll ---- */
      const hs = page.querySelector('#hscroll');
      const track = page.querySelector('#hTrack');
      if (hs && track) {
        if (!mobile) {
          const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
          gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: {
              trigger: hs, start: 'center center', end: () => '+=' + dist(),
              pin: true, scrub: 0.3, invalidateOnRefresh: true, anticipatePin: 1
            }
          });
        }
        gsap.from(track.children, {
          x: 120, opacity: 0, duration: 1.2, ease: EASE, stagger: 0.07,
          scrollTrigger: { trigger: track, start: 'top 90%' }
        });
      }

      /* ---- Project cards ---- */
      page.querySelectorAll('[data-proj]').forEach((card) => {
        gsap.from(card, { y: 110, opacity: 0, duration: 1.3, ease: EASE, scrollTrigger: { trigger: card, start: 'top 92%' } });
        const media = card.querySelector('.proj-media-inner');
        if (media) {
          gsap.fromTo(media, { scale: 1.12 }, {
            scale: 1, ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'center center', scrub: true }
          });
        }
      });

      /* ---- Toolkit bubbles ---- */
      const tools = page.querySelector('#tools');
      if (tools) {
        const bubbles = tools.querySelectorAll('.bubble');
        gsap.set(bubbles, { x: 0, y: 0, xPercent: -50, yPercent: -50 });
        gsap.from(bubbles, {
          scale: 0, duration: 0.9, ease: 'back.out(1.8)', stagger: { each: 0.035, from: 'random' },
          scrollTrigger: { trigger: tools, start: 'top 75%' }
        });
        // Gentle float — only runs while the block is on screen
        const floats = gsap.timeline({ paused: true });
        bubbles.forEach((b) => {
          floats.to(b, { y: rand(-12, 12), x: rand(-8, 8), duration: rand(2.4, 4.2), ease: 'sine.inOut', yoyo: true, repeat: -1 }, rand(0, 1.5));
        });
        ST.create({ trigger: tools, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? floats.play() : floats.pause()) });
        gsap.from(tools.querySelector('.tools-center'), {
          y: 50, opacity: 0, scale: 0.94, duration: 1.2, ease: EASE,
          scrollTrigger: { trigger: tools, start: 'top 70%' }
        });
        gsap.fromTo(tools, { y: 80 }, { y: -40, ease: 'none', scrollTrigger: { trigger: tools, start: 'top bottom', end: 'bottom top', scrub: true } });
      }

      /* ---- Timeline: line draws with scroll, milestones pop in ---- */
      const timeline = page.querySelector('#timeline');
      const clip = page.querySelector('#tlClipRect');
      if (timeline && clip) {
        const pts = Array.from(timeline.querySelectorAll('.tl-pt'));
        gsap.set(pts, { x: 0, y: 0, xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
        gsap.set(clip, { attr: { width: 0 } });
        const shown = pts.map(() => false);
        ST.create({
          trigger: timeline, start: 'top 75%', end: 'bottom 45%', scrub: 0.3,
          onUpdate: (self) => {
            const p = self.progress;
            clip.setAttribute('width', (p * 1020).toFixed(1));
            pts.forEach((pt, i) => {
              const on = p >= parseFloat(pt.dataset.at);
              if (on !== shown[i]) {
                shown[i] = on;
                gsap.to(pt, { opacity: on ? 1 : 0, scale: on ? 1 : 0.6, duration: 0.6, ease: on ? 'back.out(2)' : 'power2.out', overwrite: true });
              }
            });
          }
        });
        gsap.from(timeline.querySelectorAll('.tl-list li'), {
          x: -30, opacity: 0, duration: 1, ease: EASE, stagger: 0.12,
          scrollTrigger: { trigger: timeline, start: 'top 80%' }
        });
      }

      /* ---- Testimonial cards ---- */
      const quotes = page.querySelectorAll('#quotes .quote');
      if (quotes.length) {
        gsap.from(quotes, { y: 40, opacity: 0, duration: 1, ease: EASE, stagger: 0.06, scrollTrigger: { trigger: '#quotes', start: 'top 88%' } });
      }

      /* ---- Footer: giant "Get in touch" rises and turns neon ---- */
      const footer = document.getElementById('footer');
      const giant = document.getElementById('giant');
      if (footer && giant) {
        const tl = gsap.timeline({ scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 15%', scrub: 0.3 } });
        tl.fromTo(giant, { y: 160, opacity: 0.3, color: '#5E6A12' }, { y: 0, opacity: 1, color: '#E4FF1A', ease: 'none' }, 0)
          .from(giant.querySelectorAll('.gli'), { yPercent: 105, stagger: 0.15, ease: 'none' }, 0);
      }

      /* ---- Lavender "sunrise" glow between sections ---- */
      const glowSections = Array.from(page.querySelectorAll('[data-glow]'));
      if (glow && glowSections.length) {
        gsap.set(glow, { x: 0, y: 0, xPercent: -50, yPercent: 45, opacity: 0 });
        const setOpacity = gsap.quickSetter(glow, 'opacity');
        const setY = gsap.quickSetter(glow, 'yPercent');
        // One trigger per section; ScrollTrigger caches positions, so no layout reads while scrolling
        const vals = glowSections.map(() => 0);
        let last = -1;
        const apply = () => {
          const v = Math.max(...vals);
          if (Math.abs(v - last) < 0.004) return; // skip redundant writes
          last = v;
          setOpacity(v * 0.95);
          setY(45 - v * 30);
        };
        glowSections.forEach((s, i) => {
          ST.create({
            trigger: s, start: 'top bottom', end: 'top 5%',
            onUpdate: (self) => { vals[i] = Math.sin(self.progress * Math.PI); apply(); },
            onToggle: (self) => { if (!self.isActive) { vals[i] = 0; apply(); } }
          });
        });
      }

      /* ---- Pause CSS marquees while off-screen ---- */
      page.querySelectorAll('.strip, .marquee').forEach((el) => {
        el.classList.add('is-off');
        ST.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => el.classList.toggle('is-off', !s.isActive) });
      });
    });

    firstRun = false;
    lastMobile = mobile;
    requestAnimationFrame(() => ST.refresh());
  }

  /* ---------------- Wire up to the router ---------------- */
  const currentPage = () => document.querySelector('.page.page-active');

  document.addEventListener('ux:page', (e) => setupPage(e.detail && e.detail.el));
  setupPage(currentPage());

  window.addEventListener('load', () => ST.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());

  // Rebuild when crossing the mobile breakpoint (pinning on/off)
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (isMobile() !== lastMobile) setupPage(currentPage());
    }, 200);
  });
})();
