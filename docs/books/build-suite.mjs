// Generates the static UXONIC Books landing pages into /books (website: uxonicdigital.com/books/).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
const SITE = 'https://www.uxonicdigital.com';
// The UXONIC Books app (separate project). Every "Log in" / "Start free trial" points here.
const APP = 'https://books.uxonicdigital.com';
const SIGNUP = `${APP}/signup`;
const LOGIN = `${APP}/login`;

const NAV = [
  ['suite', '/books/', 'Books'],
  ['crm', '/books/crm/', 'CRM'],
  ['billing', '/books/billing/', 'Billing'],
  ['erp', '/books/erp/', 'ERP'],
  ['hr', '/books/hr/', 'HR'],
];

const ORG = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'UXONIC Digital Solutions', url: SITE, logo: `${SITE}/images/logo-mark-ink.png`,
  email: 'info@uxonicdigital.com', telephone: '+91 98430 21717',
  address: { '@type': 'PostalAddress', addressLocality: 'Tiruchirappalli', addressRegion: 'Tamil Nadu', addressCountry: 'IN' } };
const KEYWORDS = 'billing software Tamil Nadu, GST billing software Trichy, CRM software Chennai, inventory software Coimbatore, HR attendance software Madurai, invoice software India, UXONIC Books, small business software Tamil Nadu, Zoho alternative India';
const crumb = (path, name) => ({ '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: 'UXONIC', item: `${SITE}/` },
  { '@type': 'ListItem', position: 2, name: 'UXONIC Books', item: `${SITE}/books/` },
  ...(path !== '/books/' ? [{ '@type': 'ListItem', position: 3, name, item: `${SITE}${path}` }] : []),
] });
const app = (name, desc, price) => ({ '@type': 'SoftwareApplication', name, description: desc, applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS (browser)', url: SIGNUP, publisher: { '@id': `${SITE}/#org` }, areaServed: ['Tamil Nadu', 'India'], inLanguage: 'en-IN',
  ...(price ? { offers: { '@type': 'Offer', price: String(price), priceCurrency: 'INR', category: 'subscription', url: SIGNUP } } : {}) });
const ld = (o) => `  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': o })}</script>`;

const head = ({ title, desc, path, crumbName = 'UXONIC Books', product }) => `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <meta name="keywords" content="${KEYWORDS}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#FAFAF7" />
  <meta name="geo.region" content="IN-TN" />
  <meta name="geo.placename" content="Tiruchirappalli, Tamil Nadu" />
  <link rel="canonical" href="${SITE}${path}" />
  <link rel="alternate" hreflang="en-IN" href="${SITE}${path}" />
  <link rel="alternate" hreflang="x-default" href="${SITE}${path}" />
  <meta property="og:site_name" content="UXONIC Books" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:title" content="${title}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}${path}" />
  <meta property="og:image" content="${SITE}/cover.jpg" />
  <meta property="og:description" content="${desc}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/jpeg" href="/images/fav.jpeg" />
  <link rel="apple-touch-icon" href="/images/fav.jpeg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="/assets/css/site.css?v=5" />
  <link rel="stylesheet" href="/books/assets/suite.css?v=4" />
${ld([ORG, crumb(path, crumbName), ...(product ? [app(product.name, desc, product.price)] : [])])}
</head>

<body class="suite">

  <div class="cursor" aria-hidden="true"></div>
  <div class="glow-layer" aria-hidden="true"></div>

  <a href="https://wa.me/919843021717" target="_blank" rel="noopener" class="whatsapp-float" aria-label="Chat on WhatsApp">
    <i class="fab fa-whatsapp"></i>
  </a>
`;

const header = (active) => `
  <header class="header" id="header">
    <div class="header-container">
      <a href="/books/" class="logo" aria-label="UXONIC Books">
        <img class="logo-mark" src="/images/logo-mark-ink.png" alt="" width="40" height="40">
        <span class="logo-text"><span class="acc">U</span>XO<span class="acc">N</span>IC</span>
        <span class="suite-tag">Books</span>
      </a>
      <nav class="nav" id="nav">
        <ul class="nav-list">
${NAV.map(([k, href, label]) => `          <li><a href="${href}" class="nav-link${k === active ? ' active' : ''}"${k === active ? ' aria-current="page"' : ''}>${label}</a></li>`).join('\n')}
        </ul>
        <a href="${LOGIN}" class="btn btn-ghost nav-cta-mobile">Log in</a>
        <a href="${SIGNUP}" class="btn btn-lime nav-cta-mobile">Start free trial <i class="fas fa-arrow-right"></i></a>
      </nav>
      <div class="header-actions">
        <a href="${LOGIN}" class="header-login">Log in</a>
        <a href="${SIGNUP}" class="btn btn-lime btn-sm header-cta">Start free trial</a>
      </div>
      <button class="hamburger" id="hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <div class="page-wrapper" id="pageWrapper">
    <main class="page page-active" id="page-${active}">
`;

const footer = () => `
    </main>
  </div>

  <footer class="footer" id="footer">
    <div class="container">
      <a href="${SIGNUP}" class="giant" id="giant" aria-label="Start your free trial">
        <span class="gl"><span class="gli">Grow</span></span>
        <span class="gl"><span class="gli">smarter.</span></span>
      </a>
      <div class="giant-links">
        <a href="mailto:info@uxonicdigital.com">info@uxonicdigital.com</a>
        <a href="https://wa.me/919843021717" target="_blank" rel="noopener">+91 98430 21717</a>
        <a href="/">uxonicdigital.com</a>
      </div>

      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/books/" class="logo">
            <img class="logo-mark" src="/images/logo-mark-white.png" alt="" width="40" height="40">
            <span class="logo-text"><span class="acc">U</span>XO<span class="acc">N</span>IC</span>
          </a>
          <p>UXONIC Books — CRM, billing, inventory and soon HR in one workspace. Manage your business. Grow smarter.</p>
          <div class="socials">
            <a href="https://www.instagram.com/uxon.ic/" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="https://wa.me/919843021717" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a href="https://www.linkedin.com/company/uxonic-digital-solutions/" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
            <a href="mailto:info@uxonicdigital.com" aria-label="Email"><i class="fas fa-envelope"></i></a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Books</h4>
          <ul>
            <li><a href="/books/crm/">UXONIC CRM</a></li>
            <li><a href="/books/billing/">UXONIC Billing</a></li>
            <li><a href="/books/erp/">UXONIC ERP</a></li>
            <li><a href="/books/hr/">UXONIC HR · soon</a></li>
            <li><a href="/books/#pricing">Pricing</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="/">UXONIC Digital Solutions</a></li>
            <li><a href="/#services">Services</a></li>
            <li><a href="/careers/">Careers</a></li>
            <li><a href="/#contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <ul>
            <li><a href="mailto:info@uxonicdigital.com">info@uxonicdigital.com</a></li>
            <li><a href="https://wa.me/919843021717">+91 98430 21717</a></li>
            <li><a href="${SIGNUP}">Start free trial</a></li>
            <li><a href="${LOGIN}">Log in</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 UXONIC Digital Solutions. All rights reserved.</p>
        <p>Trichy · Tamil Nadu · India</p>
      </div>
    </div>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="/books/assets/suite.js?v=2"></script>
  <script src="/assets/js/motion.js?v=4"></script>
</body>

</html>
`;

/* ---------- Reusable blocks ---------- */

const SIDE = [
  ['g', 'Workspace'], ['overview', 'fa-house', 'Overview'],
  ['g', 'CRM'], ['leads', 'fa-user-plus', 'Leads'], ['pipeline', 'fa-table-columns', 'Pipeline'], ['contacts', 'fa-address-book', 'Contacts'], ['tasks', 'fa-list-check', 'Tasks'],
  ['g', 'Billing'], ['quotes', 'fa-file-lines', 'Quotations'], ['invoices', 'fa-file-invoice', 'Invoices'], ['payments', 'fa-indian-rupee-sign', 'Payments'], ['expenses', 'fa-receipt', 'Expenses'],
  ['g', 'ERP'], ['products', 'fa-boxes-stacked', 'Products'], ['stock', 'fa-warehouse', 'Stock'], ['purchases', 'fa-truck', 'Purchases'],
  ['g', 'Coming soon'], ['hr', 'fa-id-badge', 'HR', true],
];
const shot = (on, url, main) => `
          <div class="device-stage" aria-hidden="true">
            <div class="device-float" data-hero="device">
              <div class="shot">
                <div class="shot-bar"><span></span><span></span><span></span><em>${url}</em></div>
                <div class="shot-body">
                  <aside class="shot-side">
                    <div class="ws"><i>K</i> Kaveri Interiors</div>
${SIDE.map((s) => s[0] === 'g' ? `                    <div class="grp">${s[1]}</div>` : `                    <a class="${s[0] === on ? 'on' : ''}${s[3] ? ' soon' : ''}"><i class="fas ${s[1]}"></i>${s[2]}</a>`).join('\n')}
                  </aside>
                  <div class="shot-main">
${main}
                  </div>
                </div>
              </div>
            </div>
          </div>`;

const kanban = (dragIdx = 1) => {
  const cols = [
    ['New', '6', [['Website revamp', '₹45,000', 'A'], ['Instagram ads', '₹18,000', 'R'], ['Logo &amp; branding', '₹22,000', 'S']]],
    ['Qualified', '4', [['Modular kitchen', '₹2,40,000', 'S'], ['Office branding', '₹60,000', 'A'], ['Clinic interiors', '₹1,80,000', 'M']]],
    ['Proposal sent', '3', [['E-commerce app', '₹3,20,000', 'M'], ['SEO retainer', '₹25,000/mo', 'R']]],
    ['Won', '8', [['Clinic website', '₹55,000', 'S'], ['Textile catalogue', '₹38,000', 'A']]],
  ];
  return `<div class="kanban">${cols.map(([t, n, cards], ci) => `<div class="k-col${t === 'Won' ? ' won' : ''}"><small>${t} <em>${n}</em></small>${cards.map(([b, v, a], i) => `<div class="k-card${ci === dragIdx && i === 0 ? ' drag' : ''}"><b>${b}</b><div class="row"><span>${v}</span><span class="av">${a}</span></div></div>`).join('')}</div>`).join('')}</div>`;
};

const priceCard = ({ name, month, forWho, users, contacts, items, pop }) => `
            <article class="card price-card${pop ? ' is-pop' : ''}">
              ${pop ? '<span class="pop">Most popular</span>' : ''}
              <h3>${name}</h3>
              <p class="for">${forWho}</p>
              <div class="amt" data-month="${month}"><b>₹${month.toLocaleString('en-IN')}</b><span>/ month</span></div>
              <div class="gst">+ GST</div>
              <div class="limits"><div><b>${users}</b><span>${users === '1' ? 'user' : 'users'}</span></div><div><b>${contacts}</b><span>contacts</span></div></div>
              <ul>
${items.map(([t, off]) => `                <li${off ? ' class="off"' : ''}><i class="fas ${off ? 'fa-minus' : 'fa-check'}"></i> ${t}</li>`).join('\n')}
              </ul>
              <a href="${SIGNUP}" class="btn ${pop ? 'btn-lime' : 'btn-ink'}">Start free trial <i class="fas fa-arrow-right"></i></a>
            </article>`;

// PROPOSED prices (₹/month, excl. GST) — confirm before publishing. The same numbers live in the app's plans table.
const SINGLE_APPS = [
  ['crm', 'UXONIC CRM', 'Leads, pipeline, tasks', 299, 'fa-user-plus'],
  ['billing', 'UXONIC Billing', 'GST invoices, quotes, payments', 299, 'fa-file-invoice'],
  ['erp', 'UXONIC ERP', 'Products, stock, purchases', 399, 'fa-boxes-stacked'],
  ['hr', 'UXONIC HR', 'Employees, attendance, leave', 299, 'fa-id-badge'],
];

const pricing = (title = 'One subscription. <em>Every app.</em>', lead = 'UXONIC Books gives you CRM, Billing, ERP and HR in one workspace. Need just one? Take that app on its own. Every plan starts with a 14-day free trial — no card needed.') => `
      <section class="section" id="pricing" data-glow>
        <div class="container price-wrap" data-cycle>
          <div class="sec-head">
            <span class="sec-dot"></span>
            <h2 class="h-xl" data-split>${title}</h2>
            <p class="lead" data-fade>${lead}</p>
          </div>
          <div class="cycle" role="group" aria-label="Billing cycle">
            <button type="button" data-v="monthly" class="on">Monthly</button>
            <button type="button" data-v="yearly">Yearly <em>2 months free</em></button>
          </div>
          <div class="price-grid" data-stagger>
${priceCard({ name: 'Books Starter', month: 599, forWho: 'For owners and very small teams who want everything in one place.', users: '2', contacts: '1,000', items: [['All apps: CRM · Billing · ERP · HR'], ['GST invoices &amp; quotations'], ['Leads, pipeline &amp; tasks'], ['Stock &amp; purchases'], ['Attendance for up to 10 staff'], ['Multiple pipelines &amp; export', true]] })}
${priceCard({ name: 'Books Growth', month: 999, pop: true, forWho: 'For growing teams that sell, bill and manage stock together.', users: '5', contacts: '5,000', items: [['All apps: CRM · Billing · ERP · HR'], ['Everything in Starter'], ['Expenses &amp; approvals'], ['Team assignment &amp; reports'], ['Attendance for up to 50 staff'], ['Multiple pipelines &amp; export', true]] })}
${priceCard({ name: 'Books Business', month: 1999, forWho: 'For companies with several teams, branches and pipelines.', users: '15', contacts: '20,000', items: [['All apps: CRM · Billing · ERP · HR'], ['Everything in Growth'], ['Multiple pipelines &amp; branches'], ['Advanced permissions'], ['Data export'], ['Priority support']] })}
          </div>

          <div class="apps-price" data-rise>
            <div class="apps-price-head">
              <h3>Need just one app?</h3>
              <p>Each app on its own for up to 2 users. <b>Need 2 or more apps? UXONIC Books costs less.</b></p>
            </div>
            <div class="apps-price-grid">
${SINGLE_APPS.map(([k, name, what, price, icon]) => `              <a class="apps-price-item" href="/books/${k}/"><i class="fas ${icon}"></i><span><b>${name}</b><small>${what}</small></span><span class="amt" data-month="${price}"><b>₹${price}</b><span>/ month</span></span></a>`).join('\n')}
            </div>
          </div>
          <p class="price-foot">Prices exclude GST. Yearly plans cost 10 months. Upgrade from a single app to UXONIC Books any time — your data stays.</p>
        </div>
      </section>`;

const XL = [
  ['crm', '/books/crm/', 'fa-user-plus', 'UXONIC CRM', 'Leads, pipeline, tasks'],
  ['billing', '/books/billing/', 'fa-file-invoice', 'UXONIC Billing', 'Quotes, invoices, payments'],
  ['erp', '/books/erp/', 'fa-boxes-stacked', 'UXONIC ERP', 'Products, stock, purchases'],
  ['hr', '/books/hr/', 'fa-id-badge', 'UXONIC HR', 'Coming soon'],
];
const xlinks = (active) => `
      <section class="section" style="padding-top:0">
        <div class="container">
          <div class="sec-head" style="margin-bottom:40px">
            <span class="sec-dot"></span>
            <h2 class="h-lg" data-split>One workspace. <em>Every module.</em></h2>
          </div>
          <div class="xlinks" data-stagger>
${XL.map(([k, href, ic, t, s]) => `            <a href="${href}" class="card xlink lift${k === active ? ' on' : ''}"${k === active ? ' aria-current="page"' : ''}><i class="fas ${ic} ic"></i><span><b>${t}</b><small>${k === active ? 'You are here' : s}</small></span><i class="fas fa-arrow-right"></i></a>`).join('\n')}
          </div>
        </div>
      </section>`;

const MODULE_OPTS = ['CRM', 'Billing', 'ERP', 'CRM + Billing', 'HR (coming soon)', 'Everything'];
const waitlist = ({ module, title, lead, points }) => `
      <section class="section" id="early-access" style="padding-top:0" data-glow>
        <div class="container">
          <div class="quick-wrap">
            <div class="card quick" data-rise>
              <div>
                <span class="sec-dot" style="margin-left:0"></span>
                <h2>${title}</h2>
                <p class="lead">${lead}</p>
                <ul class="quick-points">
${points.map((p) => `                  <li><i class="fas fa-circle-check"></i> ${p}</li>`).join('\n')}
                </ul>
              </div>
              <form class="qf" data-waitlist="${module}" novalidate>
                <input type="text" name="website" tabindex="-1" autocomplete="off" style="display:none" aria-hidden="true" />
                <div class="two">
                  <div><label for="wName">Your name</label><input class="field" id="wName" name="name" autocomplete="name" placeholder="Your name" required /></div>
                  <div><label for="wEmail">Work email</label><input class="field" id="wEmail" name="email" type="email" autocomplete="email" placeholder="you@company.com" required /></div>
                </div>
                <div class="two">
                  <div><label for="wCompany">Business name</label><input class="field" id="wCompany" name="company" autocomplete="organization" placeholder="e.g. ABC Digital" /></div>
                  <div><label for="wPhone">Phone (optional)</label><input class="field" id="wPhone" name="phone" type="tel" autocomplete="tel" placeholder="+91" /></div>
                </div>
                <div class="two">
                  <div><label for="wModule">Interested in</label><select class="field" id="wModule" name="module">${MODULE_OPTS.map((o) => `<option${o === module ? ' selected' : ''}>${o}</option>`).join('')}</select></div>
                  <div><label for="wTeam">Team size</label><select class="field" id="wTeam" name="team"><option>Just me</option><option>2–5</option><option>6–15</option><option>16–50</option><option>50+</option></select></div>
                </div>
                <button class="btn btn-lime" type="submit">Request early access <i class="fas fa-arrow-right"></i></button>
                <p class="qf-status" role="status" aria-live="polite"></p>
              </form>
            </div>
          </div>
        </div>
      </section>`;

const startBlock = ({ title, lead, points }) => `
      <section class="section" id="start" style="padding-top:0" data-glow>
        <div class="container">
          <div class="quick-wrap">
            <div class="card quick" data-rise>
              <div>
                <span class="sec-dot" style="margin-left:0"></span>
                <h2>${title}</h2>
                <p class="lead">${lead}</p>
                <ul class="quick-points">
${points.map((p) => `                  <li><i class="fas fa-circle-check"></i> ${p}</li>`).join('\n')}
                </ul>
              </div>
              <div class="start-actions">
                <a href="${SIGNUP}" class="btn btn-lime">Start free trial <i class="fas fa-arrow-right"></i></a>
                <a href="${SIGNUP}?with=google" class="btn btn-ghost google-btn"><img src="/books/assets/google-g.svg" alt="" width="18" height="18"> Sign up with Google</a>
                <a href="https://wa.me/919843021717?text=${encodeURIComponent('Hi, I would like a demo of UXONIC Books')}" target="_blank" rel="noopener" class="btn btn-ghost"><i class="fab fa-whatsapp"></i> Book a free demo</a>
                <p class="start-login">Already have an account? <a href="${LOGIN}">Log in</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>`;

const secHead = (title, lead, tag = 'h-xl') => `
          <div class="sec-head">
            <span class="sec-dot"></span>
            <h2 class="${tag}" data-split>${title}</h2>
            ${lead ? `<p class="lead" data-fade>${lead}</p>` : ''}
          </div>`;

const fCards = (items) => `
          <div class="f-grid" data-stagger>
${items.map(([ic, t, p, list]) => `            <article class="card f-card lift"><span class="f-ic"><i class="fas ${ic}"></i></span><h3>${t}</h3><p>${p}</p>${list ? `<ul>${list.map((l) => `<li><i class="fas fa-check"></i>${l}</li>`).join('')}</ul>` : ''}</article>`).join('\n')}
          </div>`;

const split = ({ rev, kicker, title, text, ticks, stage, stageClass = '' }) => `
          <div class="split${rev ? ' rev' : ''}">
            <div data-rise>
              <span class="kicker">${kicker}</span>
              <h3>${title}</h3>
              <p>${text}</p>
              <ul class="ticks">
${ticks.map((t) => `                <li><i class="fas fa-check"></i> ${t}</li>`).join('\n')}
              </ul>
            </div>
            <div class="stage ${stageClass}" data-rise aria-hidden="true">
${stage}
            </div>
          </div>`;

const faqLd = (items) => ld([{ '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }]);
const faq = (items) => `
${faqLd(items)}
      <section class="section" style="padding-top:0">
        <div class="container">
          <div class="faq-grid">
            <div data-rise>
              <span class="sec-dot" style="margin-left:0"></span>
              <h2 class="h-lg">Questions, <em>answered</em></h2>
              <p class="lead">Something else on your mind? Message us on WhatsApp or write to info@uxonicdigital.com.</p>
              <a href="https://wa.me/919843021717" target="_blank" rel="noopener" class="btn btn-ink">Chat with us <i class="fab fa-whatsapp"></i></a>
            </div>
            <div data-rise>
${items.map(([q, a]) => `              <div class="faq-item"><button class="faq-question" type="button">${q}<span class="faq-icon"><i class="fas fa-plus"></i></span></button><div class="faq-answer"><p>${a}</p></div></div>`).join('\n')}
            </div>
          </div>
        </div>
      </section>`;

const keypad = (icons) => `
          <div class="device-stage" aria-hidden="true" style="height:clamp(260px,34vw,400px)">
            <div class="device-float" data-hero="device">
              <div class="device">
${icons.map(([ic, cls]) => `                <div class="key${cls ? ' ' + cls : ''}"><i class="fas ${ic}"></i></div>`).join('\n')}
              </div>
            </div>
          </div>`;

const strip = (items) => `
      <div class="strip" aria-hidden="true">
        <div class="strip-track">
${[...items, ...items].map(([ic, t]) => `          <span class="strip-item"><i class="fas ${ic}"></i> ${t}</span>`).join('\n')}
        </div>
      </div>`;

/* ================= PAGE: SUITE ================= */
const suiteMain = `
                    <div class="shot-head"><b>Good morning, Arun</b><span class="mini-btn">+ New lead</span></div>
                    <div class="kpis">
                      <div class="kpi"><small>New leads · Nov</small><b>48</b><span class="up">▲ 12%</span></div>
                      <div class="kpi"><small>Pipeline value</small><b>₹8.4L</b><span class="up">▲ 6%</span></div>
                      <div class="kpi"><small>Revenue · Nov</small><b>₹3.1L</b><span class="up">▲ 18%</span></div>
                      <div class="kpi"><small>Unpaid invoices</small><b>₹62K</b><span class="up" style="color:#A26A00">4 due</span></div>
                    </div>
                    <div class="charts">
                      <div class="panel"><small>Monthly revenue</small><div class="bars">${[38, 52, 44, 60, 56, 72, 64, 78, 70, 86, 80, 96].map((h, i) => `<span style="--h:${h}%"${i === 11 ? ' class="hi"' : ''}></span>`).join('')}</div></div>
                      <div class="panel"><small>Lead conversion</small><div class="funnel"><div style="--w:100%"><span>Leads · 48</span></div><div style="--w:72%"><span>Contacted · 35</span></div><div style="--w:48%"><span>Qualified · 23</span></div><div style="--w:30%"><span>Proposal · 14</span></div><div style="--w:18%"><span>Won · 9</span></div></div></div>
                    </div>`;

const suite = head({ title: 'UXONIC Books | GST Billing, CRM, Inventory & HR Software for Tamil Nadu Businesses', desc: 'UXONIC Books from Trichy — GST invoices, CRM, inventory (ERP) and HR attendance in one app for small businesses in Tamil Nadu and across India. One subscription or pick single apps. 14-day free trial.', path: '/books/', product: { name: 'UXONIC Books', price: 599 } })
  + header('suite') + `
      <section class="hero">
        <div class="container hero-inner">
          <div class="eyebrow" data-hero="eyebrow"><b>New</b> UXONIC Books · 14-day free trial</div>
          <h1 class="hero-title" data-split>
            <span class="line line-1">Manage your business.</span>
            <span class="line line-2">Grow smarter.</span>
          </h1>
          <p class="hero-sub" data-hero="sub">Leads, customers, quotations, invoices and payments — in one workspace your whole team can use. One login. One subscription. Made for small businesses in India.</p>
          <div class="hero-ctas" data-hero="ctas">
            <a href="${SIGNUP}" class="btn btn-lime">Start free trial <i class="fas fa-arrow-right"></i></a>
            <a href="#pricing" class="btn btn-ghost">See pricing</a>
          </div>
          <p class="hero-note" data-hero="sub">14-day free trial · no card needed · prices from ₹399/month</p>
${shot('overview', 'app.uxonicdigital.com', suiteMain)}
        </div>
      </section>
${strip([['fa-user-plus', 'Leads &amp; contacts'], ['fa-table-columns', 'Sales pipeline'], ['fa-list-check', 'Tasks &amp; reminders'], ['fa-file-lines', 'Quotations'], ['fa-file-invoice', 'GST invoices'], ['fa-indian-rupee-sign', 'Payments &amp; UPI'], ['fa-boxes-stacked', 'Stock &amp; godowns'], ['fa-truck', 'Purchase orders'], ['fa-chart-line', 'Reports']])}

      <section class="section" data-glow>
        <div class="container">
${secHead('Four modules. <em>One workspace.</em>', 'Switch on what you need today. Add the rest when your business grows — same login, same data, same subscription.')}
          <div class="mod-grid" data-stagger>
            <a href="/books/crm/" class="card mod-card lift">
              <span class="badge-s badge-live">Live</span>
              <span class="mod-ic"><i class="fas fa-user-plus"></i></span>
              <h3><small>UXONIC</small>CRM</h3>
              <p>Never lose a lead again. Track every enquiry from first call to closed deal.</p>
              <ul><li>Leads &amp; contacts</li><li>Drag-and-drop pipeline</li><li>Tasks &amp; follow-ups</li></ul>
              <span class="more">Explore CRM <i class="fas fa-arrow-right"></i></span>
            </a>
            <a href="/books/billing/" class="card mod-card is-ink lift">
              <span class="badge-s badge-live">Live</span>
              <span class="mod-ic"><i class="fas fa-file-invoice"></i></span>
              <h3><small>UXONIC</small>Billing</h3>
              <p>Quotes that turn into invoices in one click — with the right tax and a UPI QR.</p>
              <ul><li>Quotations &amp; invoices</li><li>Payments &amp; reminders</li><li>Expenses &amp; profit</li></ul>
              <span class="more">Explore Billing <i class="fas fa-arrow-right"></i></span>
            </a>
            <a href="/books/erp/" class="card mod-card lift">
              <span class="badge-s badge-live">Live</span>
              <span class="mod-ic"><i class="fas fa-boxes-stacked"></i></span>
              <h3><small>UXONIC</small>ERP</h3>
              <p>Products, stock, purchases and godowns — connected to your invoices.</p>
              <ul><li>Stock in every godown</li><li>Suppliers &amp; purchase orders</li><li>Low-stock alerts &amp; barcodes</li></ul>
              <span class="more">Explore ERP <i class="fas fa-arrow-right"></i></span>
            </a>
            <a href="/books/hr/" class="card mod-card is-soon lift">
              <span class="badge-s badge-soon">Coming soon</span>
              <span class="mod-ic"><i class="fas fa-id-badge"></i></span>
              <h3><small>UXONIC</small>HR</h3>
              <p>Employees, attendance and leave — without another app or another login.</p>
              <ul><li>Employee profiles</li><li>Check-in &amp; attendance</li><li>Leave approvals</li></ul>
              <span class="more">See what's planned <i class="fas fa-arrow-right"></i></span>
            </a>
          </div>
        </div>
      </section>

      <section class="section hscroll" id="hscroll" data-glow>
        <div class="container">
${secHead('From sign-up to <em>first invoice</em> in an afternoon')}
        </div>
        <div class="h-viewport">
          <div class="h-track" id="hTrack">
            <article class="card h-card"><span class="vline"></span><span class="num">01</span><span class="h-icon"><i class="fas fa-user-check"></i></span><h3>Create your account</h3><p>Sign up with your email. Your 14-day trial starts straight away — no card.</p></article>
            <article class="card h-card is-accent"><span class="vline"></span><span class="num">02</span><span class="h-icon"><i class="fas fa-building"></i></span><h3>Set up your workspace</h3><p>Add your company name, logo, address and GSTIN once. Every quote and invoice uses it.</p></article>
            <article class="card h-card"><span class="vline"></span><span class="num">03</span><span class="h-icon"><i class="fas fa-users"></i></span><h3>Invite your team</h3><p>Admins, managers and employees — each sees exactly what their role allows.</p></article>
            <article class="card h-card"><span class="vline"></span><span class="num">04</span><span class="h-icon"><i class="fas fa-file-import"></i></span><h3>Bring in your leads</h3><p>Import a CSV from Excel or Google Sheets. Duplicates are caught on phone and email.</p></article>
            <article class="card h-card"><span class="vline"></span><span class="num">05</span><span class="h-icon"><i class="fas fa-handshake"></i></span><h3>Win the deal</h3><p>Move it across the pipeline, send a quotation, follow up on time.</p></article>
            <article class="card h-card is-accent"><span class="vline"></span><span class="num">06</span><span class="h-icon"><i class="fas fa-indian-rupee-sign"></i></span><h3>Get paid</h3><p>Convert the quote to an invoice, share it with a UPI QR and record the payment.</p></article>
          </div>
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${secHead('Still running sales on <em>spreadsheets and WhatsApp?</em>', '', 'h-lg')}
          <div class="compare" data-compare>
            <div class="compare-col c-label">
              <div class="c-head">What you get</div>
              <div class="c-row">Every lead and follow-up in one place</div>
              <div class="c-row">Quote → invoice → payment in one flow</div>
              <div class="c-row">CGST, SGST and IGST worked out for you</div>
              <div class="c-row">Each teammate sees only what they should</div>
              <div class="c-row">One login for CRM, billing and more</div>
            </div>
            <div class="compare-col c-mid">
              <div class="c-head">Sheets &amp; WhatsApp</div>
              <div class="c-row"><span class="no"><i class="fas fa-minus"></i></span></div>
              <div class="c-row"><span class="no"><i class="fas fa-minus"></i></span></div>
              <div class="c-row"><span class="no"><i class="fas fa-minus"></i></span></div>
              <div class="c-row"><span class="no"><i class="fas fa-minus"></i></span></div>
              <div class="c-row"><span class="no"><i class="fas fa-minus"></i></span></div>
            </div>
            <div class="compare-col c-best">
              <div class="c-head"><img class="logo-mark" src="/images/logo-mark-ink.png" alt="" width="30" height="30"> Suite</div>
              <div class="c-row"><span class="yes"><i class="fas fa-check"></i></span></div>
              <div class="c-row"><span class="yes"><i class="fas fa-check"></i></span></div>
              <div class="c-row"><span class="yes"><i class="fas fa-check"></i></span></div>
              <div class="c-row"><span class="yes"><i class="fas fa-check"></i></span></div>
              <div class="c-row"><span class="yes"><i class="fas fa-check"></i></span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
${secHead('Built for businesses <em>like yours</em>', 'From a one-person studio in Trichy to a 15-member team across Tamil Nadu.', 'h-lg')}
          <div class="aud" data-stagger>
            <span><i class="fas fa-bullhorn"></i> Digital &amp; web agencies</span>
            <span><i class="fas fa-laptop"></i> Freelancers &amp; consultants</span>
            <span><i class="fas fa-couch"></i> Interior designers</span>
            <span><i class="fas fa-helmet-safety"></i> Contractors</span>
            <span><i class="fas fa-store"></i> Local businesses</span>
            <span><i class="fas fa-briefcase"></i> Small B2B companies</span>
            <span><i class="fas fa-screwdriver-wrench"></i> Service businesses</span>
          </div>
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${secHead('Your data stays <em>yours</em>', 'Security is built into the foundation, not bolted on later.')}
${fCards([
  ['fa-lock', 'A private workspace', 'Every business gets its own workspace. Database rules — not just hidden buttons — stop anyone outside it from reading your data.'],
  ['fa-user-shield', 'Roles that make sense', 'Admin, Manager and Employee. Employees see their own leads and tasks; managers see the team; only admins touch billing and settings.'],
  ['fa-clock-rotate-left', 'Audit log &amp; export', 'Every change to leads, deals, invoices and payments is recorded. Export your data whenever you want — it is yours.'],
])}
        </div>
      </section>
${pricing()}
${faq([
  ['What is UXONIC Books?', 'One online workspace for running a small business: a CRM for leads and deals, Billing for quotations, invoices, payments and expenses, and ERP for products, stock and purchases. HR (employees, attendance and leave) is being built next and will appear in the same workspace.'],
  ['Do I need a separate login for each module?', 'No. One account, one workspace and one subscription. Modules are switched on inside your workspace based on your plan.'],
  ['Is there a free trial?', 'Yes — 14 days with Growth plan features, no payment details needed. If you do not subscribe, your workspace becomes read-only; your data is kept and you can still export it.'],
  ['How do I pay?', 'Monthly or yearly through Razorpay (UPI, cards, net banking). Yearly plans cost 10 months — two months free. Prices exclude GST.'],
  ['Can my team use it?', 'Yes. Growth includes 5 users and Business 15. Invite them by email and give each person the Admin, Manager or Employee role.'],
  ['When can I start?', 'Right now. Create your account, confirm your email and your workspace is ready in a minute — or sign up with your Google account. Prefer help? Message us on WhatsApp and we will set it up with you.'],
])}
${startBlock({ title: 'Start today. <em>Grow smarter.</em>', lead: 'Your workspace is ready in a minute. 14 days free, no card needed.', points: ['CRM, Billing and ERP included in the trial', 'Sign up with email or Google', 'Help importing your leads and products'] })}
` + footer();

/* ================= PAGE: CRM ================= */
const crmMain = `
                    <div class="shot-head"><b>Sales pipeline</b><span class="mini-btn">+ New deal</span></div>
                    ${kanban(1)}`;

const leadTimeline = `
              <div class="panel" style="padding:18px">
                <div class="shot-head" style="margin-bottom:14px"><b style="font-size:16px">Priya Raman · Nila Studios</b><span class="st st-sent">Qualified</span></div>
                <ul class="acts">
                  <li class="lime"><b>Follow-up call booked</b><span>Today, 4:30 PM · assigned to Arun</span></li>
                  <li><b>Quotation QT-0042 sent</b><span>Yesterday · ₹45,000 + GST</span></li>
                  <li><b>Status changed: Contacted → Qualified</b><span>3 Nov</span></li>
                  <li><b>Note</b><span>Wants a 5-page site and Instagram ads from January</span></li>
                  <li><b>Lead created from Instagram</b><span>1 Nov · +91 98xxx xxx21</span></li>
                </ul>
              </div>`;

const taskList = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:10px"><b style="font-size:16px">My tasks · Today</b><span class="st st-over">2 overdue</span></div>
                <table class="tbl">
                  <thead><tr><th>Task</th><th class="hide-sm">Linked to</th><th>Due</th></tr></thead>
                  <tbody>
                    <tr><td><i class="far fa-square"></i> Call back about kitchen quote</td><td class="hide-sm">Kaveri Interiors</td><td><span class="st st-over">Yesterday</span></td></tr>
                    <tr><td><i class="far fa-square"></i> Send revised proposal</td><td class="hide-sm">E-commerce app</td><td><span class="st st-over">10:00 AM</span></td></tr>
                    <tr><td><i class="far fa-square"></i> WhatsApp payment link</td><td class="hide-sm">Clinic website</td><td><span class="st st-part">2:00 PM</span></td></tr>
                    <tr><td><i class="fas fa-square-check" style="color:#2F7A2F"></i> Site visit photos</td><td class="hide-sm">Office branding</td><td><span class="st st-paid">Done</span></td></tr>
                  </tbody>
                </table>
              </div>`;

const teamReport = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:12px"><b style="font-size:16px">Team performance · Q3</b><span class="st st-draft">This quarter</span></div>
                <table class="tbl">
                  <thead><tr><th>Member</th><th class="r">Leads</th><th class="r">Won</th><th class="r">Value won</th></tr></thead>
                  <tbody>
                    <tr><td>Arun</td><td class="r">64</td><td class="r">14</td><td class="r">₹6,20,000</td></tr>
                    <tr><td>Sneha</td><td class="r">51</td><td class="r">11</td><td class="r">₹4,85,000</td></tr>
                    <tr><td>Rahul</td><td class="r">38</td><td class="r">7</td><td class="r">₹2,10,000</td></tr>
                  </tbody>
                </table>
                <div class="bars" style="height:70px;margin-top:14px">${[30, 46, 40, 58, 52, 66, 61, 74, 70, 82, 76, 90].map((h, i) => `<span style="--h:${h}%"${i === 11 ? ' class="hi"' : ''}></span>`).join('')}</div>
              </div>`;

const crm = head({ title: 'UXONIC CRM | Lead & Sales Pipeline Software for Tamil Nadu Businesses', desc: 'Track leads, follow-ups and deals in one place — WhatsApp, call and email buttons, drag-and-drop pipeline and team reports. Made in Trichy for businesses in Chennai, Coimbatore, Madurai and across Tamil Nadu.', path: '/books/crm/', crumbName: 'UXONIC CRM', product: { name: 'UXONIC CRM', price: 299 } })
  + header('crm') + `
      <section class="hero">
        <div class="container hero-inner">
          <div class="eyebrow" data-hero="eyebrow"><b>CRM</b> Part of UXONIC Books</div>
          <h1 class="hero-title" data-split>
            <span class="line line-1">Every lead.</span>
            <span class="line line-2">Every follow-up. On time.</span>
          </h1>
          <p class="hero-sub" data-hero="sub">UXONIC CRM keeps your enquiries, customers and deals in one place — so nothing slips through a WhatsApp chat or a forgotten spreadsheet again.</p>
          <div class="hero-ctas" data-hero="ctas">
            <a href="${SIGNUP}" class="btn btn-lime">Start free trial <i class="fas fa-arrow-right"></i></a>
            <a href="#features" class="btn btn-ghost">See features</a>
          </div>
${shot('pipeline', 'app.uxonicdigital.com/crm/pipeline', crmMain)}
        </div>
      </section>
${strip([['fa-user-plus', 'Leads'], ['fa-address-book', 'Contacts'], ['fa-building', 'Companies'], ['fa-table-columns', 'Pipeline'], ['fa-list-check', 'Tasks'], ['fa-bell', 'Reminders'], ['fa-users', 'Team'], ['fa-chart-pie', 'Reports']])}

      <section class="section" id="features" data-glow>
        <div class="container">
${secHead('Everything you need to <em>sell more</em>', 'Simple enough to start in five minutes. Powerful enough for a growing sales team.')}
${fCards([
  ['fa-user-plus', 'Leads', 'Capture every enquiry with source, status, priority and owner.', ['Search, filter and sort', 'CSV import with duplicate check', 'Bulk assign and status change']],
  ['fa-table-columns', 'Sales pipeline', 'A Kanban board from New to Won, with deal value on every stage.', ['Drag and drop', 'Stage totals and probability', 'Lost reason on every lost deal']],
  ['fa-list-check', 'Tasks &amp; reminders', 'Follow-ups with a date, time and owner — and a reminder before they are due.', ['My tasks, Today, Overdue', 'Linked to lead, contact or deal', 'Email and in-app reminders']],
  ['fa-address-book', 'Contacts &amp; companies', 'One profile with every call, note, deal, quote and invoice.', ['Full activity timeline', 'Linked deals and invoices', 'Company billing summary']],
  ['fa-bolt', 'Quick actions', 'Call, WhatsApp or email a lead straight from the list.', ['Click-to-chat on WhatsApp', 'Add a note or task in a tap', 'Convert lead to customer']],
  ['fa-chart-pie', 'Reports', 'See what is working: sources, conversion and team performance.', ['Leads by source and owner', 'Won/lost by period', 'Follow-up compliance']],
])}
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${split({ kicker: '<i class="fas fa-timeline"></i> Lead timeline', title: 'The whole story, <em>on one screen</em>', text: 'Open any lead and see every call, note, status change, email and task in order. Anyone picking it up knows exactly where things stand.', ticks: ['Notes, calls and status changes logged automatically', 'Convert to a contact, company and deal — history included', 'WhatsApp and email in one tap'], stage: leadTimeline })}
${split({ rev: true, kicker: '<i class="fas fa-table-columns"></i> Pipeline', title: 'Drag a deal. <em>Watch revenue move.</em>', text: 'Seven clear stages from New to Won. Drag a card to update it; the totals on each stage update with it. Marking a deal Lost asks for the reason so you learn from it.', ticks: ['Stage count and value at a glance', 'Expected close date and probability', 'Multiple pipelines on the Business plan'], stage: `<div class="panel" style="padding:12px">${kanban(2)}</div>`, stageClass: 'lime' })}
${split({ kicker: '<i class="fas fa-bell"></i> Tasks', title: 'Follow-ups that <em>actually happen</em>', text: 'Every task has an owner, a due time and a reminder. Start the day with your list; managers see the whole team’s.', ticks: ['Overdue, Today and Upcoming views', 'Reminder emails and notifications', 'Linked to the lead, contact or deal'], stage: taskList })}
${split({ rev: true, kicker: '<i class="fas fa-users"></i> Team', title: 'Know who is <em>closing</em>', text: 'Leads handled, deals won, value won and tasks completed — by person and by period. Fair, simple and visible to the people who need it.', ticks: ['Invite by email with a role', 'Deactivate a member, keep their records', 'Reassign leads in bulk'], stage: teamReport, stageClass: 'lime' })}
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
${secHead('The right access for <em>every role</em>', 'Permissions are enforced in the database, so a hidden button is never the only thing keeping data safe.', 'h-lg')}
          <div class="card roles" data-rise>
            <table>
              <thead><tr><th>What they can do</th><th>Admin</th><th>Manager</th><th>Employee</th></tr></thead>
              <tbody>
                <tr><td>View CRM records</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="own">Own &amp; assigned</span></td></tr>
                <tr><td>Create leads, contacts, deals, tasks</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td></tr>
                <tr><td>Edit any record</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="own">Own only</span></td></tr>
                <tr><td>Assign leads and tasks</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
                <tr><td>Delete records</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
                <tr><td>Team, plan &amp; workspace settings</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
${pricing('CRM is in <em>every plan</em>', 'Start on Starter at ₹399/month. Move to Growth when you want quotations and invoices too.')}
${xlinks('crm')}
${startBlock({ title: 'Stop losing leads. <em>Start with UXONIC CRM.</em>', lead: 'Free for 14 days. Bring your leads from Excel in two minutes.', points: ['14-day free trial, no card', 'Import leads from a spreadsheet', 'Works on phone, tablet and laptop'] })}
` + footer();

/* ================= PAGE: BILLING ================= */
const billMain = `
                    <div class="shot-head"><b>Invoices</b><span class="mini-btn">+ New invoice</span></div>
                    <div class="kpis">
                      <div class="kpi"><small>Billed · Nov</small><b>₹3.1L</b></div>
                      <div class="kpi"><small>Collected</small><b>₹2.5L</b></div>
                      <div class="kpi"><small>Outstanding</small><b>₹62K</b></div>
                      <div class="kpi"><small>Overdue</small><b style="color:#C93A3F">₹18K</b></div>
                    </div>
                    <div class="panel" style="padding:6px 8px">
                      <table class="tbl">
                        <thead><tr><th class="hide-sm">Number</th><th>Customer</th><th class="hide-sm">Due</th><th class="r">Amount</th><th>Status</th></tr></thead>
                        <tbody>
                          <tr><td class="hide-sm">INV/26-27/0118</td><td>Nila Studios</td><td class="hide-sm">20 Nov</td><td class="r">₹53,100</td><td><span class="st st-sent">Sent</span></td></tr>
                          <tr><td class="hide-sm">INV/26-27/0117</td><td>Trichy Textiles</td><td class="hide-sm">15 Nov</td><td class="r">₹1,18,000</td><td><span class="st st-part">Part paid</span></td></tr>
                          <tr><td class="hide-sm">INV/26-27/0116</td><td>Kaveri Interiors</td><td class="hide-sm">08 Nov</td><td class="r">₹64,900</td><td><span class="st st-paid">Paid</span></td></tr>
                          <tr><td class="hide-sm">INV/26-27/0115</td><td>Karur Motors</td><td class="hide-sm">30 Oct</td><td class="r">₹17,700</td><td><span class="st st-over">Overdue</span></td></tr>
                        </tbody>
                      </table>
                    </div>`;

const paper = `
              <div class="paper">
                <div class="paper-top">
                  <div><b>Kaveri Interiors</b>Trichy, Tamil Nadu · GSTIN 33XXXXX1234X1Z5</div>
                  <div class="num">TAX INVOICE<small>INV/26-27/0118 · 06 Nov 2026</small></div>
                </div>
                <table class="tbl">
                  <thead><tr><th>Item</th><th class="hide-sm">SAC</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead>
                  <tbody>
                    <tr><td>Website design &amp; build</td><td class="hide-sm">998314</td><td class="r">1</td><td class="r">₹35,000</td></tr>
                    <tr><td>Instagram ads (Dec)</td><td class="hide-sm">998361</td><td class="r">1</td><td class="r">₹10,000</td></tr>
                  </tbody>
                </table>
                <div class="tot">
                  <div><span>Subtotal</span><span>₹45,000</span></div>
                  <div><span>CGST 9%</span><span>₹4,050</span></div>
                  <div><span>SGST 9%</span><span>₹4,050</span></div>
                  <div class="g"><span>Total</span><span>₹53,100</span></div>
                </div>
                <div class="foot"><span>Fifty-three thousand one hundred rupees only<br><small style="color:var(--muted)">Scan to pay by UPI</small></span><span class="qr"></span></div>
              </div>`;

const paymentsPanel = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:10px"><b style="font-size:16px">INV/26-27/0117 · Trichy Textiles</b><span class="st st-part">Part paid</span></div>
                <table class="tbl">
                  <thead><tr><th>Date</th><th>Method</th><th class="hide-sm">Reference</th><th class="r">Amount</th></tr></thead>
                  <tbody>
                    <tr><td>02 Nov</td><td>UPI</td><td class="hide-sm">4312xxxx8890</td><td class="r">₹50,000</td></tr>
                    <tr><td>05 Nov</td><td>Bank transfer</td><td class="hide-sm">NEFT N3091xx</td><td class="r">₹30,000</td></tr>
                  </tbody>
                </table>
                <div class="tot" style="display:grid;gap:4px;margin:12px 0 0 auto;width:min(240px,100%);font-size:12px">
                  <div style="display:flex;justify-content:space-between"><span>Invoice total</span><span>₹1,18,000</span></div>
                  <div style="display:flex;justify-content:space-between"><span>Received</span><span>₹80,000</span></div>
                  <div style="display:flex;justify-content:space-between;font-weight:600;color:var(--ink);border-top:1px solid var(--ink);padding-top:6px"><span>Balance due</span><span>₹38,000</span></div>
                </div>
              </div>`;

const reportsPanel = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:12px"><b style="font-size:16px">Profit · FY 2026-27</b><span class="st st-paid">₹9.8L profit</span></div>
                <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
                  <div class="kpi"><small>Sales</small><b>₹21.4L</b></div>
                  <div class="kpi"><small>Expenses</small><b>₹11.6L</b></div>
                  <div class="kpi"><small>GST collected</small><b>₹3.8L</b></div>
                </div>
                <div class="bars" style="height:90px;margin-top:14px">${[44, 52, 48, 63, 58, 70, 66, 80].map((h, i) => `<span style="--h:${h}%"${i === 7 ? ' class="hi"' : ''}></span>`).join('')}</div>
              </div>`;

const billing = head({ title: 'GST Billing & Invoice Software for Tamil Nadu | UXONIC Billing', desc: 'Create GST invoices and quotations with CGST, SGST and IGST, UPI QR on every invoice, payment tracking and reminders. Simple billing software for shops, agencies and service businesses in Tamil Nadu.', path: '/books/billing/', crumbName: 'UXONIC Billing', product: { name: 'UXONIC Billing', price: 299 } })
  + header('billing') + `
      <section class="hero">
        <div class="container hero-inner">
          <div class="eyebrow" data-hero="eyebrow"><b>Billing</b> Part of UXONIC Books</div>
          <h1 class="hero-title" data-split>
            <span class="line line-1">Quote it. Invoice it.</span>
            <span class="line line-2">Get paid faster.</span>
          </h1>
          <p class="hero-sub" data-hero="sub">Professional quotations and tax invoices in under a minute — with the right GST split, a UPI QR code and reminders that chase payments for you.</p>
          <div class="hero-ctas" data-hero="ctas">
            <a href="${SIGNUP}" class="btn btn-lime">Start free trial <i class="fas fa-arrow-right"></i></a>
            <a href="#features" class="btn btn-ghost">See features</a>
          </div>
${shot('invoices', 'app.uxonicdigital.com/billing/invoices', billMain)}
        </div>
      </section>
${strip([['fa-file-lines', 'Quotations'], ['fa-file-invoice', 'Tax invoices'], ['fa-percent', 'CGST · SGST · IGST'], ['fa-qrcode', 'UPI QR'], ['fa-indian-rupee-sign', 'Payments'], ['fa-bell', 'Reminders'], ['fa-receipt', 'Expenses'], ['fa-chart-line', 'Profit reports']])}

      <section class="section" id="features" data-glow>
        <div class="container">
${secHead('Billing without the <em>busywork</em>', 'Everything from the first quote to the last rupee — connected to your CRM.')}
${fCards([
  ['fa-file-lines', 'Quotations', 'Line items with HSN/SAC, discount and tax. Send it, track it, convert it.', ['Draft, Sent, Accepted, Rejected, Expired', 'Share link and email', 'One click to invoice']],
  ['fa-file-invoice', 'Invoices', 'The same line-item engine, with a due date from your payment terms.', ['Automatic numbering per year', 'Partially paid, Paid, Overdue', 'Void keeps the number and history']],
  ['fa-indian-rupee-sign', 'Payments', 'Record UPI, cash, bank transfer, card or cheque — full or in parts.', ['Multiple partial payments', 'Reference on every payment', 'Customer statement and balance']],
  ['fa-qrcode', 'UPI QR on every invoice', 'Add your UPI ID once. Every PDF carries a QR your customer can scan.', ['Your logo and details', 'PDF generated securely', 'Email or WhatsApp it']],
  ['fa-bell', 'Payment reminders', 'Overdue invoices are spotted every day. Send a reminder now or let it go out automatically.', ['Manual or automatic', 'Overdue list on your dashboard', 'Never awkward, always on time']],
  ['fa-receipt', 'Expenses &amp; reports', 'Log expenses with a receipt photo and see sales, collections and profit.', ['Expenses by category', 'Outstanding and ageing', 'CGST/SGST/IGST summary']],
])}
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${secHead('The right tax, <em>every time</em>', 'Pick the customer. UXONIC Billing compares their place of supply with yours and splits the tax for you.', 'h-lg')}
          <div class="tax-grid" data-stagger>
            <article class="card tax-card">
              <div class="route"><span>Seller: Tamil Nadu</span><i class="fas fa-arrow-right"></i><span>Customer: Tamil Nadu</span></div>
              <h3>Same state</h3>
              <p>Tax is split equally between Central and State GST.</p>
              <div class="tax-split"><div class="c">CGST 9%</div><div class="s">SGST 9%</div></div>
              <small>On ₹45,000: ₹4,050 + ₹4,050</small>
            </article>
            <article class="card tax-card">
              <div class="route"><span>Seller: Tamil Nadu</span><i class="fas fa-arrow-right"></i><span>Customer: Karnataka</span></div>
              <h3>Different state</h3>
              <p>One Integrated GST line for inter-state supply.</p>
              <div class="tax-split"><div class="i">IGST 18%</div></div>
              <small>On ₹45,000: ₹8,100</small>
            </article>
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
${split({ kicker: '<i class="fas fa-file-invoice"></i> Quotations &amp; invoices', title: 'Looks professional. <em>Takes a minute.</em>', text: 'Your logo, GSTIN and address on every document. Line items, tax breakup, total in words and a UPI QR — generated as a PDF you can email or share.', ticks: ['Configurable prefix and yearly numbering', 'Quote → invoice keeps every line', 'Old invoices never change when prices do'], stage: paper })}
${split({ rev: true, kicker: '<i class="fas fa-indian-rupee-sign"></i> Payments', title: 'Know exactly <em>who owes what</em>', text: 'Record every payment against its invoice, however it came in. Balances, statuses and the overdue list update themselves.', ticks: ['UPI, cash, bank transfer, card, cheque', 'Partial payments with references', 'Customer statements in one click'], stage: paymentsPanel, stageClass: 'lime' })}
${split({ kicker: '<i class="fas fa-chart-line"></i> Reports', title: 'Sales minus expenses. <em>Simple.</em>', text: 'Sales by period, collections, outstanding and ageing, tax totals and expenses by category — the numbers you need for your accountant and yourself.', ticks: ['CGST / SGST / IGST summary', 'Outstanding and ageing', 'Simple profit view'], stage: reportsPanel })}
        </div>
      </section>

      <section class="section" style="padding-top:0" data-glow>
        <div class="container">
${secHead('Every invoice, <em>always accounted for</em>', '', 'h-lg')}
          <div class="flow" data-stagger>
            <span class="step"><i class="fas fa-pen"></i> Draft</span><span class="arrow"><i class="fas fa-arrow-right"></i></span>
            <span class="step is-violet"><i class="fas fa-paper-plane"></i> Sent</span><span class="arrow"><i class="fas fa-arrow-right"></i></span>
            <span class="step"><i class="fas fa-circle-half-stroke"></i> Partially paid</span><span class="arrow"><i class="fas fa-arrow-right"></i></span>
            <span class="step is-lime"><i class="fas fa-check"></i> Paid</span>
          </div>
          <p class="flow-note">Past the due date it becomes <b>Overdue</b>. Cancelling makes it <b>Void</b> — the number and audit trail stay; issued invoices are never deleted.</p>
        </div>
      </section>
${pricing('Billing comes with <em>Growth and Business</em>', 'CRM and Billing together from ₹799/month — with a 14-day free trial.')}
      <section class="section" style="padding-top:0">
        <div class="container"><p class="price-foot" style="max-width:760px;margin:0 auto">Invoices are designed around Indian GST rules. Please have your chartered accountant review your invoice format before you rely on it for filing. E-invoicing and e-way bills are not supported yet.</p></div>
      </section>
${xlinks('billing')}
${startBlock({ title: 'Send your next invoice <em>with UXONIC.</em>', lead: 'Add your logo, GSTIN and UPI ID once — every invoice after that takes a minute.', points: ['14-day free trial, no card', 'CGST / SGST / IGST worked out for you', 'UPI QR on every invoice'] })}
` + footer();

/* ================= PAGE: ERP ================= */
const erpMain = `
                    <div class="shot-head"><b>Stock</b><span class="mini-btn">+ New product</span></div>
                    <div class="kpis">
                      <div class="kpi"><small>Stock value</small><b>₹4.8L</b></div>
                      <div class="kpi"><small>Products</small><b>312</b></div>
                      <div class="kpi"><small>Low stock</small><b style="color:#A26A00">7</b></div>
                      <div class="kpi"><small>Open POs</small><b>3</b></div>
                    </div>
                    <div class="panel" style="padding:6px 8px">
                      <table class="tbl">
                        <thead><tr><th>Product</th><th class="hide-sm">Godown</th><th class="r">In hand</th><th>Status</th></tr></thead>
                        <tbody>
                          <tr><td>LED bulb 9W</td><td class="hide-sm">Main godown</td><td class="r">150 pcs</td><td><span class="st st-paid">In stock</span></td></tr>
                          <tr><td>PVC pipe 1 inch</td><td class="hide-sm">Madurai branch</td><td class="r">42 m</td><td><span class="st st-paid">In stock</span></td></tr>
                          <tr><td>Extension board</td><td class="hide-sm">Main godown</td><td class="r">6 pcs</td><td><span class="st st-part">Low stock</span></td></tr>
                          <tr><td>Ceiling fan 48"</td><td class="hide-sm">Main godown</td><td class="r">0 pcs</td><td><span class="st st-over">Out of stock</span></td></tr>
                        </tbody>
                      </table>
                    </div>`;

const ledgerPanel = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:10px"><b style="font-size:16px">LED bulb 9W · stock history</b><span class="st st-paid">150 pcs</span></div>
                <table class="tbl">
                  <thead><tr><th>When</th><th>Type</th><th class="r">Qty</th><th class="hide-sm">Source</th></tr></thead>
                  <tbody>
                    <tr><td>Today</td><td><span class="st st-part">Sale</span></td><td class="r">−30</td><td class="hide-sm">INV/26-27/0118</td></tr>
                    <tr><td>10 Nov</td><td><span class="st st-paid">Purchase</span></td><td class="r">+50</td><td class="hide-sm">PO/26-27/0001</td></tr>
                    <tr><td>09 Nov</td><td><span class="st st-sent">Transfer</span></td><td class="r">−30</td><td class="hide-sm">To Madurai branch</td></tr>
                    <tr><td>01 Nov</td><td><span class="st st-paid">Opening</span></td><td class="r">+160</td><td class="hide-sm">Opening stock</td></tr>
                  </tbody>
                </table>
              </div>`;

const poPanel = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:10px"><b style="font-size:16px">PO/26-27/0007 · Sri Murugan Electricals</b><span class="st st-part">Partly received</span></div>
                <table class="tbl">
                  <thead><tr><th>Product</th><th class="r">Ordered</th><th class="r">Received</th></tr></thead>
                  <tbody>
                    <tr><td>Extension board 4-way</td><td class="r">30</td><td class="r">30</td></tr>
                    <tr><td>Ceiling fan 48"</td><td class="r">12</td><td class="r">5</td></tr>
                    <tr><td>Switch 6A (box of 20)</td><td class="r">10</td><td class="r">0</td></tr>
                  </tbody>
                </table>
                <div class="tot" style="display:grid;gap:4px;margin:12px 0 0 auto;width:min(240px,100%);font-size:12px">
                  <div style="display:flex;justify-content:space-between;font-weight:600;color:var(--ink);border-top:1px solid var(--ink);padding-top:6px"><span>PO total</span><span>₹48,380</span></div>
                </div>
              </div>`;

const labelsPanel = `
              <div class="panel" style="padding:16px">
                <div class="shot-head" style="margin-bottom:12px"><b style="font-size:16px">Barcode labels</b><span class="st st-draft">A4 · 3 per row</span></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${['LED bulb 9W', 'Extension board', 'PVC pipe 1"'].map((n, i) => `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;background:#fff;color:#111"><div style="font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</div><div style="height:30px;margin:6px 0;background:repeating-linear-gradient(90deg,#111 0 ${1 + (i % 2)}px,#fff ${1 + (i % 2)}px ${3 + i}px,#111 ${3 + i}px ${5 + i}px,#fff ${5 + i}px 7px)"></div><div style="font-size:9px;font-family:monospace">89012345${i}789${i}</div><div style="font-size:11px;font-weight:700">₹${[142, 531, 89][i]}</div></div>`).join('')}</div>
              </div>`;

const erp = head({ title: 'Inventory & Stock Management Software for Tamil Nadu | UXONIC ERP', desc: 'Products, stock in every godown or branch, suppliers, purchase orders, low-stock alerts and barcode labels — connected to your GST invoices. Inventory software for shops, traders and distributors in Tamil Nadu.', path: '/books/erp/', crumbName: 'UXONIC ERP', product: { name: 'UXONIC ERP', price: 399 } })
  + header('erp') + `
      <section class="hero">
        <div class="container hero-inner">
          <div class="eyebrow" data-hero="eyebrow"><b>ERP</b> Part of UXONIC Books</div>
          <h1 class="hero-title" data-split>
            <span class="line line-1">Know your stock.</span>
            <span class="line line-2">In every godown.</span>
          </h1>
          <p class="hero-sub" data-hero="sub">UXONIC ERP keeps your products, stock, suppliers and purchases together — and because it sits next to your invoices, every sale reduces stock on its own.</p>
          <div class="hero-ctas" data-hero="ctas">
            <a href="${SIGNUP}" class="btn btn-lime">Start free trial <i class="fas fa-arrow-right"></i></a>
            <a href="#features" class="btn btn-ghost">See features</a>
          </div>
${shot('stock', 'books.uxonicdigital.com/erp/stock', erpMain)}
        </div>
      </section>
${strip([['fa-tags', 'Products &amp; services'], ['fa-warehouse', 'Godowns &amp; branches'], ['fa-right-left', 'Stock transfers'], ['fa-truck', 'Suppliers'], ['fa-clipboard-list', 'Purchase orders'], ['fa-triangle-exclamation', 'Low-stock alerts'], ['fa-barcode', 'Barcode labels'], ['fa-file-csv', 'Stock export']])}

      <section class="section" id="features" data-glow>
        <div class="container">
${secHead('Stock that <em>keeps itself up to date</em>', 'Made for shops, traders, distributors and contractors who are tired of counting on paper.')}
${fCards([
  ['fa-tags', 'Products &amp; services', 'One list with SKU, barcode, HSN, GST rate, unit, selling price and cost.', ['Categories and units (pcs, kg, m, box…)', 'Goods with stock, services without', 'Shared with your invoice lines']],
  ['fa-warehouse', 'Stock per godown', 'See what is in hand in each godown or branch — and the total.', ['Stock in, stock out, physical count', 'Move stock between godowns', 'Opening stock in minutes']],
  ['fa-file-invoice', 'Linked to invoices', 'Issue a GST invoice and the items leave stock automatically. Void it and they come back.', ['Pick products on the invoice', 'Choose which godown it ships from', 'No double entry']],
  ['fa-clipboard-list', 'Suppliers &amp; purchase orders', 'Raise a PO, mark it ordered, then receive goods — all at once or in parts.', ['Automatic PO numbers per year', 'Partly received tracking', 'Received stock costed at the PO rate']],
  ['fa-triangle-exclamation', 'Low-stock alerts', 'Set a reorder level per product and see what to buy before you run out.', ['Low and out-of-stock lists', 'On your dashboard every morning', 'Stock value at cost']],
  ['fa-barcode', 'Barcode labels', 'Print Code 128 labels with name and price; scan to find a product instantly.', ['A4 sheets, 3 labels per row', 'Works with any USB barcode scanner', 'Your own codes or SKUs']],
])}
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${split({ kicker: '<i class="fas fa-clock-rotate-left"></i> Stock history', title: 'Every piece, <em>accounted for</em>', text: 'Stock only changes through a recorded entry — a sale, a purchase, a count or a transfer — with who did it and why. Entries cannot be edited later, so the numbers always add up.', ticks: ['Linked back to the invoice or purchase order', 'Reason on every manual change', 'Filter by godown, product or type'], stage: ledgerPanel })}
${split({ rev: true, kicker: '<i class="fas fa-truck"></i> Purchases', title: 'Order it. Receive it. <em>Done.</em>', text: 'Raise a purchase order to your supplier, mark it ordered, and receive goods as they arrive. Stock goes up the moment you receive — never before, never twice.', ticks: ['Receive in parts; we track what is pending', 'Cannot receive more than you ordered', 'GST input shown on every PO'], stage: poPanel, stageClass: 'lime' })}
${split({ kicker: '<i class="fas fa-barcode"></i> Labels', title: 'Scan, sell, <em>move on</em>', text: 'Print barcode stickers for your shelves and boxes. At the counter, scan a product into the invoice instead of searching for it.', ticks: ['Code 128 — readable by every scanner', 'Price including GST on the label', 'Print as many copies as you need'], stage: labelsPanel })}
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
${secHead('The right access for <em>every role</em>', 'Permissions are enforced in the database, so a hidden button is never the only thing keeping stock safe.', 'h-lg')}
          <div class="card roles" data-rise>
            <table>
              <thead><tr><th>What they can do</th><th>Admin</th><th>Manager</th><th>Employee</th></tr></thead>
              <tbody>
                <tr><td>View products and stock</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td></tr>
                <tr><td>Add and edit products</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
                <tr><td>Adjust and transfer stock</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
                <tr><td>Suppliers and purchase orders</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
                <tr><td>Godowns and categories</td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="yes"><i class="fas fa-check"></i></span></td><td><span class="no"><i class="fas fa-minus"></i></span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
${pricing('ERP is in <em>UXONIC Books</em>', 'Get ERP with CRM, Billing and HR in one subscription — or take UXONIC ERP on its own. 14-day free trial.')}
${faq([
  ['Does selling on an invoice reduce stock?', 'Yes. When you issue an invoice with products on it, those quantities leave stock from the godown you chose (or your default godown). If you void the invoice, the stock comes back.'],
  ['Can I manage more than one godown or branch?', 'Yes. Add as many godowns as you need, see stock in each, and move stock between them with a transfer entry.'],
  ['How do I enter my current stock?', 'Add your products, then use Update stock → Opening stock for each one. Prefer help? Send us your Excel sheet on WhatsApp and we will help you load it.'],
  ['Does it work with a barcode scanner?', 'Yes. Any USB or Bluetooth scanner that types the code works — scan into the product search or the invoice product picker. You can also print Code 128 labels from UXONIC ERP.'],
  ['What about manufacturing, batches and expiry?', 'Not yet. UXONIC ERP covers products, stock, godowns, suppliers and purchase orders today. Tell us what you need next — we build in the order our customers ask.'],
])}
${xlinks('erp')}
${startBlock({ title: 'Count less. <em>Sell more.</em>', lead: 'Add your products and opening stock today — your next invoice will update stock for you.', points: ['14-day free trial, no card', 'Stock linked to your GST invoices', 'Works on phone, tablet and laptop'] })}
` + footer();

/* ================= COMING SOON PAGES ================= */
const soon = ({ key, path, title, desc, crumbName, price, eyebrow, h1a, h1b, sub, icons, scopeTitle, scopeLead, scope, road, why }) =>
  head({ title, desc, path, crumbName, product: { name: crumbName, price } }) + header(key) + `
      <section class="hero">
        <div class="container hero-inner">
          <div class="eyebrow" data-hero="eyebrow"><b>${eyebrow}</b> Coming soon to UXONIC Books</div>
          <h1 class="hero-title" data-split>
            <span class="line line-1">${h1a}</span>
            <span class="line line-2">${h1b}</span>
          </h1>
${keypad(icons)}
          <p class="hero-sub" data-hero="sub">${sub}</p>
          <div class="hero-ctas" data-hero="ctas">
            <a href="#early-access" class="btn btn-lime">Notify me at launch <i class="fas fa-arrow-right"></i></a>
            <a href="${SIGNUP}" class="btn btn-ghost">Start with CRM, Billing &amp; ERP</a>
          </div>
          <p class="hero-note" data-hero="sub"><span class="soon-badge">In development</span></p>
        </div>
      </section>

      <section class="section" data-glow>
        <div class="container">
${secHead(scopeTitle, scopeLead)}
${fCards(scope)}
        </div>
      </section>

      <section class="section" style="padding-top:0" data-glow>
        <div class="container">
${secHead('How we plan to <em>roll it out</em>', 'Released in stages so each part is solid before the next one ships. Early-access members help shape the order.', 'h-lg')}
          <div class="road" data-stagger>
${road.map(([phase, t, items]) => `            <article class="card"><span class="phase">${phase}</span><h3>${t}</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></article>`).join('\n')}
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
          <div class="card join" data-rise>
            <div>
              <span class="eyebrow"><b>Connected</b> Same workspace</span>
              <h2 style="margin-top:24px">${why[0]}</h2>
              <p>${why[1]}</p>
              <a href="/books/" class="btn btn-ink">See the whole Suite <i class="fas fa-arrow-right"></i></a>
            </div>
            <ul class="perks">
${why[2].map((p) => `              <li><i class="fas fa-check"></i> ${p}</li>`).join('\n')}
            </ul>
          </div>
        </div>
      </section>
${xlinks(key)}
${waitlist({ module: 'HR (coming soon)', title: `Be the first to try <em>UXONIC ${key.toUpperCase()}.</em>`, lead: 'Join the list and we will invite you to the beta. Already need CRM, Billing or ERP? You can start with those today and add HR later.', points: ['Early beta invitation', 'Tell us what you need most', 'Founding-customer pricing'] })}
` + footer();

const hr = soon({
  key: 'hr', path: '/books/hr/', crumbName: 'UXONIC HR', price: 299,
  title: 'HR, Attendance & Leave Software for Small Businesses in Tamil Nadu | UXONIC HR',
  desc: 'Employee records, mobile check-in attendance, shifts, leave requests and approvals and monthly attendance reports for small teams in Tamil Nadu. Part of UXONIC Books.',
  eyebrow: 'HR', h1a: 'Your people, attendance and leave.', h1b: 'Sorted.',
  sub: 'UXONIC HR will keep employee records, daily attendance and leave approvals together — in the same workspace your team already uses.',
  icons: [['fa-id-badge'], ['fa-clock'], ['fa-calendar-check', 'is-ink'], ['fa-users'], ['fa-fingerprint', 'is-lime'], ['fa-umbrella-beach'], ['fa-sitemap'], ['fa-location-dot'], ['fa-chart-pie']],
  scopeTitle: 'What UXONIC HR <em>will do</em>', scopeLead: 'Planned scope — made for small teams that are tired of attendance registers.',
  scope: [
    ['fa-id-badge', 'Employee profiles', 'Personal and job details, documents, department and designation — with or without an app login.'],
    ['fa-fingerprint', 'Check-in &amp; check-out', 'Employees mark attendance from their phone, with optional location.', ['Late and half-day rules', 'Shift timings', 'Manager corrections with history']],
    ['fa-umbrella-beach', 'Leave', 'Leave types and balances, requests and one-tap approvals.'],
    ['fa-calendar-days', 'Holidays &amp; shifts', 'A holiday calendar and shifts per team or branch.'],
    ['fa-sitemap', 'Departments', 'Organise people by department and designation.'],
    ['fa-chart-pie', 'Attendance reports', 'Monthly attendance, late marks and leave taken — ready for payroll.'],
  ],
  road: [
    ['Stage 1', 'People', ['Employee profiles', 'Departments and designations', 'Documents']],
    ['Stage 2', 'Attendance', ['Check-in / check-out', 'Shifts and holidays', 'Attendance reports']],
    ['Stage 3', 'Leave &amp; beyond', ['Leave types and balances', 'Requests and approvals', 'Payroll — planned after launch']],
  ],
  why: ['One team, <em>one workspace</em>', 'Not every employee needs a login, and not every login is an employee. UXONIC HR keeps the two separate — and connected where it helps.', ['Link an employee to a workspace member', 'Same roles and permissions', 'Branch support from day one', 'Switch it on when your plan includes it']],
});

// One folder per page → clean URLs (/books/crm/) that work on any static server and on Vercel.
for (const [dir, html] of [['', suite], ['crm', crm], ['billing', billing], ['erp', erp], ['hr', hr]]) {
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, 'index.html'), html);
}
console.log('ok');
