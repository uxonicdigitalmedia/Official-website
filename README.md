# UXONIC Digital Solutions — website

Static site deployed on Vercel (`outputDirectory: "."`) + Vercel Functions in `api/`.

```
index.html                Home (one-page site: Home / Services / About / Contact)
careers/                  /careers/      — job openings (public)
internship/               /internship/   — internship application (public, not indexed)

books/                    UXONIC Books — PRODUCT pages for clients
  index.html              /books/         overview + pricing (Books bundle + single apps)
  crm/ billing/ erp/ hr/  /books/crm/ …   one landing page per app
  assets/                 suite.css, suite.js
                          (the app itself lives in the separate repo `uxonic-books` → books.uxonicdigital.com)

erp/                      UXONIC's OWN internal ERP (our employees, payroll, invoices) — /erp/
  index.html login.html   staff app + sign-in
  me.html client.html     employee portal, client portal
  js/ erp.css
admin/                    Website admin panel — /admin/ (jobs, applications, contacts, content)
  books.html books.js     Admin → UXONIC Books: customers, revenue, payments, plans & prices
                          (talks to the UXONIC Books database with the owner's Google sign-in)

api/                      Vercel Functions (contact, apply, jobs, admin/*, erp)
assets/
  css/                    site.css (site-wide), internship.css (careers + internship)
  js/                     script.js (router), motion.js (scroll animations), internship.js
images/                   logos, photos (also used in emails / social previews — keep paths)

database/                 SQL to run in Supabase (not deployed): supabase_schema.sql first, then the rest
docs/                     plans and the suite page generator (not deployed)
```

Two different things — don't mix them up:
- **`/erp/`** is our internal tool for running UXONIC.
- **`/books/`** is the product we sell (UXONIC Books); clients sign up there for their own business.

## Run locally

```bash
npm install
npm run dev          # http://127.0.0.1:5501  (serves pages + /api like Vercel)
```

Every page is a folder with an `index.html`, and all internal links use folder URLs (`/careers/`, `/books/crm/`),
so pages also open with VS Code Live Server — but forms, login and data need `npm run dev` (Live Server has no `/api`).

## Edit the UXONIC Books pages

They are generated so header, footer, pricing and forms stay identical:

```bash
node docs/books/build-suite.mjs books
```
