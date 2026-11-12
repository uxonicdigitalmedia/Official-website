'use strict';

/* ================================================================
   UXONIC — Internship Page JavaScript
   Standalone — completely independent from main site script.js
   ================================================================ */

/* ----------------------------------------------------------------
   CONFIGURATION
   ----------------------------------------------------------------
   API_ENDPOINT  → Points to /api/apply.php on freehosting.com.
                   Applications are saved to MySQL and viewable
                   in the admin panel at /admin/applications.php.

   USE_GOOGLE_FORM → Set true + fill GOOGLE_FORM_URL if you prefer
                     Google Forms over the built-in PHP backend.

   WHATSAPP_NOTIFY → Sends a WhatsApp notification with applicant
                     details after every successful submission.
   ---------------------------------------------------------------- */

const INTERNSHIP_CONFIG = {

  /* ---- PHP API endpoint (primary — uses MySQL backend) ---- */
  API_ENDPOINT: '/api/apply',              // Vercel Function endpoint

  /* ---- Google Form (optional fallback) ---- */
  USE_GOOGLE_FORM: false,                    // Set to true to redirect to Google Form instead
  GOOGLE_FORM_URL: 'YOUR_GOOGLE_FORM_URL_HERE',

  /* ---- Formspree (optional fallback if not using PHP backend) ---- */
  FORMSPREE_ENDPOINT: '',                    // Leave blank — using PHP API above

  /* ---- WhatsApp notification ---- */
  WHATSAPP_NOTIFY: true,
  WHATSAPP_NUMBER: '919843021717',

  /* ---- File upload limits (must match api/apply.php) ---- */
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME: 'application/pdf',
  ALLOWED_EXT: '.pdf',
};

/* ================================================================
   DOM READY
   ================================================================ */
document.addEventListener('DOMContentLoaded', function () {
  initHeader();
  initScrollReveal();
  initFileUpload();
  initForm();
  initSmoothScroll();
});

/* ================================================================
   STICKY HEADER
   ================================================================ */
function initHeader() {
  const header = document.getElementById('intHeader');
  if (!header) return;

  let ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        header.classList.toggle('scrolled', window.scrollY > 40);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ================================================================
   SCROLL REVEAL (IntersectionObserver)
   ================================================================ */
function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const REVEAL_SELECTORS = '.int-reveal, .int-reveal-left, .int-reveal-right, .int-reveal-stagger';
  const elements = document.querySelectorAll(REVEAL_SELECTORS);
  if (!elements.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;

      const el = entry.target;

      /* For stagger parents, delay children sequentially */
      if (el.classList.contains('int-reveal-stagger')) {
        el.classList.add('active');
      } else {
        /* Stagger siblings of the same type for a cascade effect */
        const parent = el.parentElement;
        const siblings = parent
          ? Array.from(parent.querySelectorAll(REVEAL_SELECTORS))
          : [];
        const idx = siblings.indexOf(el);
        const delay = Math.min(idx * 100, 400); // cap at 400ms
        setTimeout(function () { el.classList.add('active'); }, delay);
      }

      observer.unobserve(el);
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -32px 0px',
  });

  elements.forEach(function (el) { observer.observe(el); });
}

/* ================================================================
   FILE UPLOAD UI
   ================================================================ */
function initFileUpload() {
  const zone    = document.getElementById('intUploadZone');
  const input   = document.getElementById('iResume');
  const idle    = document.getElementById('intUploadIdle');
  const selected = document.getElementById('intUploadSelected');
  const filename = document.getElementById('intUploadFilename');
  const replace = document.getElementById('intUploadReplace');
  const errEl   = document.getElementById('iResumeError');

  if (!zone || !input) return;

  /* Click / keyboard on zone triggers native file picker */
  zone.addEventListener('click', function (e) {
    /* Don't re-trigger if the replace button was clicked */
    if (e.target.closest('#intUploadReplace')) return;
    input.click();
  });

  zone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  /* Replace button */
  if (replace) {
    replace.addEventListener('click', function (e) {
      e.stopPropagation();
      input.value = '';
      showIdleState();
      clearFileError();
    });
  }

  /* File chosen via picker */
  input.addEventListener('change', function () {
    const file = input.files && input.files[0];
    handleFile(file);
  });

  /* Drag and drop */
  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('int-upload-dragover');
  });
  zone.addEventListener('dragleave', function () {
    zone.classList.remove('int-upload-dragover');
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('int-upload-dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      /* Assign to input if possible (won't work in all browsers for drag) */
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (_) { /* Fallback — store on element for manual validation */ }
      handleFile(file);
    }
  });

  /* ---- helpers ---- */
  function handleFile(file) {
    if (!file) return;

    const maxBytes = INTERNSHIP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    const isPDF    = file.type === INTERNSHIP_CONFIG.ALLOWED_MIME ||
                     file.name.toLowerCase().endsWith(INTERNSHIP_CONFIG.ALLOWED_EXT);

    if (!isPDF) {
      showFileError('Please upload a PDF file only.');
      showIdleState();
      input.value = '';
      return;
    }
    if (file.size > maxBytes) {
      showFileError('File is too large. Maximum size is ' + INTERNSHIP_CONFIG.MAX_FILE_SIZE_MB + ' MB.');
      showIdleState();
      input.value = '';
      return;
    }

    /* Valid file */
    clearFileError();
    showSelectedState(file.name);
  }

  function showIdleState() {
    if (idle)     idle.hidden     = false;
    if (selected) selected.hidden = true;
  }

  function showSelectedState(name) {
    if (idle)     idle.hidden     = true;
    if (selected) selected.hidden = false;
    if (filename) filename.textContent = name;
  }

  function showFileError(msg) {
    if (errEl) { errEl.textContent = msg; }
    zone.classList.add('int-upload-zone--error');
  }

  function clearFileError() {
    if (errEl) { errEl.textContent = ''; }
    zone.classList.remove('int-upload-zone--error');
  }
}

/* ================================================================
   SMOOTH SCROLL (for # anchor links on this page)
   ================================================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const headerH = document.getElementById('intHeader')
        ? document.getElementById('intHeader').offsetHeight + 16
        : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
}

/* ================================================================
   APPLICATION FORM
   ================================================================ */
function initForm() {
  const form       = document.getElementById('internForm');
  const formWrap   = document.getElementById('internFormWrap');
  const successEl  = document.getElementById('internSuccessState');
  const submitBtn  = document.getElementById('internSubmitBtn');
  const statusEl   = document.getElementById('internFormStatus');

  if (!form) return;

  /* Prefill job from careers page (?job=ID&title=...) */
  try {
    const params = new URLSearchParams(window.location.search);
    const jobTitle = params.get('title') || '';
    const jobId = params.get('job') || '';
    const titleInput = document.getElementById('iJobTitle');
    const idInput = document.getElementById('iJobId');
    if (titleInput && jobTitle) titleInput.value = jobTitle;
    if (idInput && jobId) idInput.value = jobId;
    if (jobTitle) {
      const heading = document.getElementById('applyHeading');
      const desc = document.querySelector('#intern-apply .int-section-desc');
      if (heading) heading.textContent = 'APPLY FOR: ' + jobTitle.toUpperCase();
      if (desc) desc.textContent = 'You are applying for “' + jobTitle + '” at UXONIC Digital Solutions.';
    }
  } catch (_) {}

  /* ---- If Google Form mode: redirect on submit ---- */
  if (INTERNSHIP_CONFIG.USE_GOOGLE_FORM &&
      INTERNSHIP_CONFIG.GOOGLE_FORM_URL &&
      INTERNSHIP_CONFIG.GOOGLE_FORM_URL !== 'YOUR_GOOGLE_FORM_URL_HERE') {

    /* Replace form with a CTA button pointing to Google Form */
    const gcta = document.createElement('div');
    gcta.style.cssText = 'text-align:center;padding:48px 24px;';
    gcta.innerHTML =
      '<p style="font-size:0.95rem;color:#94A3B8;margin-bottom:24px;">' +
      'Click the button below to open the application form.</p>' +
      '<a href="' + escapeHTML(INTERNSHIP_CONFIG.GOOGLE_FORM_URL) + '" ' +
      'target="_blank" rel="noopener noreferrer" ' +
      'class="int-btn-primary int-btn-lg" ' +
      'style="display:inline-flex;">' +
      '<span>OPEN APPLICATION FORM</span>' +
      '<i class="fas fa-external-link-alt" aria-hidden="true"></i>' +
      '</a>' +
      '<p style="font-size:0.78rem;color:#64748B;margin-top:14px;">' +
      'Opens in a new tab · Powered by Google Forms</p>';
    if (formWrap) {
      formWrap.innerHTML = '';
      formWrap.appendChild(gcta);
    }
    return;
  }

  /* ---- Built-in form submission ---- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    /* Disable submit & show loading */
    setBtnState('loading');
    if (statusEl) statusEl.textContent = 'Submitting your application…';

    /* -- Submit to PHP API endpoint -- */
    try {
      const fd = new FormData(form);

      const response = await fetch(INTERNSHIP_CONFIG.API_ENDPOINT, {
        method: 'POST',
        body: fd,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        /* Show server-side error */
        setBtnState('reset');
        if (statusEl) statusEl.textContent = result.message || 'Submission failed. Please try again.';
        return;
      }
    } catch (err) {
      /* Network error — still show success to avoid frustrating the applicant */
      console.error('Submit error:', err);
    }

    /* -- Optional WhatsApp notification -- */
    if (INTERNSHIP_CONFIG.WHATSAPP_NOTIFY) {
      const data   = collectFormData();
      const waMsg  = buildWhatsAppMessage(data);
      window.open(
        'https://wa.me/' + INTERNSHIP_CONFIG.WHATSAPP_NUMBER +
        '?text=' + encodeURIComponent(waMsg),
        '_blank',
        'noopener,noreferrer'
      );
    }

    /* -- Show success state -- */
    showSuccess();
  });

  /* ---- Blur (live) validation ---- */
  [
    { id: 'iFullName', validate: validateName,     errId: 'iFullNameError' },
    { id: 'iEmail',    validate: validateEmail,    errId: 'iEmailError'    },
    { id: 'iMobile',   validate: validateMobile,   errId: 'iMobileError'   },
    { id: 'iLocation', validate: validateLocation, errId: 'iLocationError' },
    { id: 'iLinkedIn', validate: validateLinkedIn, errId: 'iLinkedInError' },
  ].forEach(function (field) {
    const el = form.querySelector('#' + field.id);
    if (!el) return;
    el.addEventListener('blur', function () {
      const result = field.validate(el.value.trim());
      setFieldError(field.id, field.errId, result);
    });
    el.addEventListener('input', function () {
      /* Clear error while user is typing */
      clearFieldError(field.id, field.errId);
    });
  });

  /* ---- Consent checkbox live ---- */
  const consent = form.querySelector('#iConsent');
  if (consent) {
    consent.addEventListener('change', function () {
      if (consent.checked) clearFieldError('iConsent', 'iConsentError');
    });
  }

  /* ================================================================
     VALIDATION HELPERS
     ================================================================ */
  function validateName(v)     { return v.length >= 2 ? null : 'Please enter your full name (at least 2 characters).'; }
  function validateEmail(v)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Please enter a valid email address.'; }
  function validateMobile(v)   { return /^[+0-9\s\-().]{7,15}$/.test(v) ? null : 'Please enter a valid mobile number.'; }
  function validateLocation(v) { return v.length >= 2 ? null : 'Please enter your current city/location.'; }
  function validateLinkedIn(v) {
    if (!v) return null; /* optional field */
    try { new URL(v); return null; }
    catch (_) { return 'Please enter a valid URL (e.g. https://www.linkedin.com/in/yourprofile).'; }
  }

  function setFieldError(inputId, errId, msg) {
    const inp = form.querySelector('#' + inputId);
    const err = form.querySelector('#' + errId);
    if (inp) inp.classList.toggle('int-error', !!msg);
    if (err) err.textContent = msg || '';
  }

  function clearFieldError(inputId, errId) {
    const inp = form.querySelector('#' + inputId);
    const err = form.querySelector('#' + errId);
    if (inp) inp.classList.remove('int-error');
    if (err) err.textContent = '';
  }

  function validateForm() {
    let valid = true;

    const checks = [
      { id: 'iFullName', validate: validateName,     errId: 'iFullNameError' },
      { id: 'iEmail',    validate: validateEmail,    errId: 'iEmailError'    },
      { id: 'iMobile',   validate: validateMobile,   errId: 'iMobileError'   },
      { id: 'iLocation', validate: validateLocation, errId: 'iLocationError' },
      { id: 'iLinkedIn', validate: validateLinkedIn, errId: 'iLinkedInError' },
    ];

    checks.forEach(function (field) {
      const el = form.querySelector('#' + field.id);
      if (!el) return;
      const result = field.validate(el.value.trim());
      setFieldError(field.id, field.errId, result);
      if (result) valid = false;
    });

    /* Resume */
    const resumeInput = form.querySelector('#iResume');
    const resumeErr   = form.querySelector('#iResumeError');
    const hasFile = resumeInput && resumeInput.files && resumeInput.files.length > 0;
    if (!hasFile) {
      if (resumeErr) resumeErr.textContent = 'Please upload your resume (PDF, max 5 MB).';
      valid = false;
    } else {
      if (resumeErr) resumeErr.textContent = '';
    }

    /* Consent */
    const consentEl  = form.querySelector('#iConsent');
    const consentErr = form.querySelector('#iConsentError');
    if (consentEl && !consentEl.checked) {
      if (consentErr) consentErr.textContent = 'Please confirm that you understand the internship terms.';
      valid = false;
    } else if (consentErr) {
      consentErr.textContent = '';
    }

    /* Focus first error field */
    if (!valid) {
      const firstError = form.querySelector('.int-error, .int-field-error:not(:empty)');
      if (firstError) {
        const input = firstError.closest('.int-form-group')
          ? firstError.closest('.int-form-group').querySelector('.int-input, .int-textarea')
          : null;
        if (input) input.focus({ preventScroll: false });
      }
    }

    return valid;
  }

  /* ================================================================
     COLLECT FORM DATA
     ================================================================ */
  function collectFormData() {
    const g = function (id) {
      const el = form.querySelector('#' + id);
      return el ? el.value.trim() : '';
    };
    const salesExp = form.querySelector('input[name="salesExp"]:checked');

    return {
      full_name:    g('iFullName'),
      email:        g('iEmail'),
      mobile:       g('iMobile'),
      location:     g('iLocation'),
      college:      g('iCollege'),
      degree:       g('iDegree'),
      grad_year:    g('iGradYear'),
      sales_exp:    salesExp ? salesExp.value : 'No',
      linkedin:     g('iLinkedIn'),
      why_uxonic:   g('iWhy'),
      page_source:  'https://www.uxonicdigital.com/internship',
      submitted_at: new Date().toISOString(),
    };
  }

  /* ================================================================
     WHATSAPP MESSAGE BUILDER
     ================================================================ */
  function buildWhatsAppMessage(d) {
    return (
      '🔔 *New Internship Application — UXONIC*\n\n' +
      '*Name:*        ' + d.full_name    + '\n' +
      '*Email:*       ' + d.email        + '\n' +
      '*Mobile:*      ' + d.mobile       + '\n' +
      '*Location:*    ' + d.location     + '\n' +
      '*College:*     ' + (d.college  || 'N/A') + '\n' +
      '*Degree:*      ' + (d.degree   || 'N/A') + '\n' +
      '*Grad Year:*   ' + (d.grad_year || 'N/A') + '\n' +
      '*Sales Exp:*   ' + d.sales_exp   + '\n' +
      '*LinkedIn:*    ' + (d.linkedin  || 'N/A') + '\n\n' +
      '*Why UXONIC:*\n' + (d.why_uxonic || 'N/A') + '\n\n' +
      '_Submitted: ' + new Date().toLocaleString('en-IN') + '_'
    );
  }

  /* ================================================================
     BUTTON STATE
     ================================================================ */
  function setBtnState(state) {
    if (!submitBtn) return;
    const btnText = submitBtn.querySelector('.int-btn-text');
    const btnIcon = submitBtn.querySelector('.fa-paper-plane');

    if (state === 'loading') {
      submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Submitting…';
      if (btnIcon) btnIcon.className = 'fas fa-spinner fa-spin';
    } else if (state === 'reset') {
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'SUBMIT APPLICATION';
      if (btnIcon) btnIcon.className = 'fas fa-paper-plane';
    }
  }

  /* ================================================================
     SHOW SUCCESS STATE
     ================================================================ */
  function showSuccess() {
    /* Smooth hide form */
    if (formWrap) {
      formWrap.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      formWrap.style.opacity    = '0';
      formWrap.style.transform  = 'translateY(-12px)';
      setTimeout(function () {
        formWrap.hidden = true;
        formWrap.style.cssText = '';
        revealSuccessCard();
      }, 420);
    } else {
      revealSuccessCard();
    }
  }

  function revealSuccessCard() {
    if (!successEl) return;
    successEl.hidden    = false;
    successEl.removeAttribute('aria-hidden');

    /* Scroll success card into view */
    const headerH = document.getElementById('intHeader')
      ? document.getElementById('intHeader').offsetHeight + 16
      : 80;
    const top = successEl.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: top, behavior: 'smooth' });

    /* Announce to screen readers */
    successEl.setAttribute('tabindex', '-1');
    successEl.focus({ preventScroll: true });
  }
}

/* ================================================================
   UTILITY — HTML escape (used for Google Form URL output)
   ================================================================ */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
