// Builds /privacy/ and /terms/ — one source so both pages share the same look.
// Run from the repo root:  node docs/legal/build-legal.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const UPDATED = '13 November 2026';
const CONTACT = `<a href="mailto:info@uxonicdigital.com">info@uxonicdigital.com</a>`;

const page = ({ path, title, description, heading, lead, sections }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | UXONIC Digital Solutions</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="https://www.uxonicdigital.com${path}" />
  <link rel="icon" type="image/jpeg" href="/images/fav.jpeg" />
  <meta name="theme-color" content="#FAFAF7" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/legal.css?v=1" />
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="lg-header">
    <div class="lg-wrap lg-header-in">
      <a href="/" class="lg-logo" aria-label="UXONIC home">
        <img src="/images/logo-mark-ink.png" alt="" width="34" height="34" />
        <span><b>U</b>XO<b>N</b>IC</span>
      </a>
      <nav class="lg-nav" aria-label="Legal">
        <a href="/privacy/"${path === '/privacy/' ? ' aria-current="page"' : ''}>Privacy</a>
        <a href="/terms/"${path === '/terms/' ? ' aria-current="page"' : ''}>Terms</a>
        <a href="/books/">UXONIC Books</a>
      </nav>
    </div>
  </header>

  <main id="content" class="lg-wrap lg-main">
    <div class="lg-head">
      <p class="lg-eyebrow">Last updated ${UPDATED}</p>
      <h1>${heading}</h1>
      <p class="lg-lead">${lead}</p>
    </div>
    <div class="lg-body">
      <aside class="lg-toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
${sections.map(([id, h]) => `          <li><a href="#${id}">${h}</a></li>`).join('\n')}
        </ol>
      </aside>
      <article class="lg-article">
${sections.map(([id, h, body]) => `        <section id="${id}">
          <h2>${h}</h2>
${body.trim().split('\n').map((l) => '          ' + l.trim()).join('\n')}
        </section>`).join('\n')}
      </article>
    </div>
  </main>

  <footer class="lg-footer">
    <div class="lg-wrap lg-footer-in">
      <p>&copy; 2026 UXONIC Digital Solutions · Trichy · Karur · Tamil Nadu, India</p>
      <p><a href="/privacy/">Privacy Policy</a> · <a href="/terms/">Terms of Service</a> · ${CONTACT} · <a href="https://wa.me/919843021717">+91 98430 21717</a></p>
    </div>
  </footer>
</body>
</html>
`;

// ---------------------------------------------------------------- Privacy Policy
const privacy = page({
  path: '/privacy/',
  title: 'Privacy Policy',
  description: 'How UXONIC Digital Solutions collects, uses and protects personal data on uxonicdigital.com and in UXONIC Books.',
  heading: 'Privacy Policy',
  lead: 'This policy explains what personal data UXONIC Digital Solutions collects on <b>uxonicdigital.com</b> and in <b>UXONIC Books</b> (CRM, Billing, ERP and HR at books.uxonicdigital.com), why, and the choices you have. We follow the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.',
  sections: [
    ['who', 'Who we are', `
      <p>UXONIC Digital Solutions (“UXONIC”, “we”, “us”) is a digital agency and software company based in Trichy and Karur, Tamil Nadu, India. You can reach us at ${CONTACT} or +91 98430 21717.</p>
    `],
    ['roles', 'Two kinds of data', `
      <p><b>Your account data.</b> When you sign up for UXONIC Books, contact us or apply for a job, we decide how that data is used. For this data we are the <i>Data Fiduciary</i>.</p>
      <p><b>Your business records.</b> The leads, customers, invoices, products, stock, employees, attendance and other records your business enters in UXONIC Books belong to your business. Your business decides what goes in and who can see it; we store and process it only to run the service for you. For this data your business is the Data Fiduciary and we act as its <i>Data Processor</i>. If you are a customer or employee of a business that uses UXONIC Books, please contact that business first about your data.</p>
    `],
    ['collect', 'What we collect', `
      <ul>
        <li><b>Account details:</b> your name, email address and, if you sign in with Google, your Google profile name and photo. We never see your Google password.</li>
        <li><b>Workspace details:</b> business name, address, phone, GSTIN, logo and settings you add.</li>
        <li><b>Business records</b> you or your team enter (see above).</li>
        <li><b>Location at check-in:</b> only in workspaces that use UXONIC HR, and only when an employee taps “Check in” with location allowed in the browser. We save that single position with the check-in. We do not track location in the background.</li>
        <li><b>Payments:</b> the plan, amount, date, method and reference of subscription payments. Card, UPI and bank details are handled by our payment partner (Razorpay) and are never stored by us.</li>
        <li><b>Support messages</b> you send us from the app, by email or WhatsApp.</li>
        <li><b>Website forms:</b> details you submit through the contact form or a job or internship application, including any resume you upload.</li>
        <li><b>Technical data:</b> IP address, browser and device type, and security logs (for example sign-in times) that keep accounts safe.</li>
      </ul>
    `],
    ['use', 'How we use it', `
      <ul>
        <li>To provide UXONIC Books: sign-in, workspaces, the features you use, and emails the service sends (invitations, reminders, invoices your business sends to its customers).</li>
        <li>To bill your subscription, send trial and renewal reminders, and answer support requests.</li>
        <li>To keep the service secure, prevent misuse and fix problems.</li>
        <li>To reply to enquiries and job applications sent through our website.</li>
        <li>To improve our products, using aggregated information that does not identify you.</li>
      </ul>
      <p>We do <b>not</b> sell personal data, we do not use your business records for advertising, and we do not show ads in UXONIC Books.</p>
    `],
    ['share', 'Who we share it with', `
      <p>We share data only with service providers that help us run UXONIC Books, under contracts that require them to protect it:</p>
      <ul>
        <li><b>Supabase</b> — database, sign-in and file storage. Data is stored on Amazon Web Services servers in the Tokyo, Japan region.</li>
        <li><b>Vercel</b> — hosting of our website and app.</li>
        <li><b>Google</b> — “Sign in with Google”, if you choose it.</li>
        <li><b>Resend</b> — delivery of the emails the service sends.</li>
        <li><b>Razorpay</b> — online subscription payments.</li>
      </ul>
      <p>Some of these providers process data outside India. We use them only where they offer protections at least as strong as this policy. We may also disclose data when Indian law requires it.</p>
    `],
    ['security', 'How we protect it', `
      <ul>
        <li>All traffic is encrypted (HTTPS).</li>
        <li>Each workspace is kept separate at the database level, so one business can never read another’s records.</li>
        <li>Inside a workspace, roles (admin, manager, employee) decide who can see and change what.</li>
        <li>Access by UXONIC staff is limited to what is needed to run the service and support you.</li>
      </ul>
      <p>No system is perfectly secure. If a breach affects your personal data, we will inform you and the Data Protection Board of India as the law requires.</p>
    `],
    ['keep', 'How long we keep it', `
      <ul>
        <li>We keep account and workspace data while your account is active.</li>
        <li>If you ask us to delete a workspace, we delete its records within <b>30 days</b>. Copies in backups are removed in the following backup cycles.</li>
        <li>Our own subscription and payment records are kept for up to 8 years, as Indian tax law requires.</li>
        <li>We keep website enquiries and job applications for up to 2 years unless you ask us to delete them sooner.</li>
      </ul>
    `],
    ['rights', 'Your rights', `
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you;</li>
        <li>correct or update it;</li>
        <li>delete it (unless we must keep it by law);</li>
        <li>nominate someone to act for you.</li>
      </ul>
      <p>You can also withdraw consent, for example by deleting your account.</p>
      <p>Write to ${CONTACT} from the email address on your account. We will respond within 30 days.</p>
    `],
    ['cookies', 'Cookies and local storage', `
      <p>We use only what is needed for the service to work: storage that keeps you signed in and remembers preferences such as the theme or the last workspace you opened. We do not use advertising or cross-site tracking cookies.</p>
    `],
    ['children', 'Children', `
      <p>UXONIC Books is meant for businesses and is not for anyone under 18. We do not knowingly collect data from children.</p>
    `],
    ['grievance', 'Grievance Officer', `
      <p>For any concern about your personal data or this policy, contact our Grievance Officer at ${CONTACT} (subject: “Privacy”). We acknowledge complaints within 48 hours and aim to resolve them within 30 days. If you are not satisfied, you may approach the Data Protection Board of India.</p>
    `],
    ['changes', 'Changes to this policy', `
      <p>If we make important changes, we will tell account holders by email or in the app before they take effect. The date at the top shows the latest version.</p>
    `],
  ],
});

// ---------------------------------------------------------------- Terms of Service
const terms = page({
  path: '/terms/',
  title: 'Terms of Service',
  description: 'The terms for using UXONIC Books — UXONIC CRM, Billing, ERP and HR — from UXONIC Digital Solutions.',
  heading: 'Terms of Service',
  lead: 'These terms are an agreement between your business and UXONIC Digital Solutions for the use of <b>UXONIC Books</b> — UXONIC CRM, UXONIC Billing, UXONIC ERP and UXONIC HR — at books.uxonicdigital.com. By creating an account or using the service you accept them.',
  sections: [
    ['service', 'The service', `
      <p>UXONIC Books is online software for running a business: leads and customers, quotations and invoices, products and stock, staff attendance and leave. You can subscribe to <b>UXONIC Books</b> (every app in one workspace) or to a single app. The features in each plan are shown on our <a href="/books/#pricing">pricing page</a> and in the app under Settings → Subscription.</p>
    `],
    ['accounts', 'Accounts and workspaces', `
      <ul>
        <li>You must be at least 18 and use UXONIC Books for a business or profession.</li>
        <li>The person who creates a workspace is its <b>admin</b>. Admins invite team members, choose their roles and are responsible for what their team does in the workspace.</li>
        <li>Keep your sign-in secure. Tell us at once at ${CONTACT} if you think someone else has used your account.</li>
        <li>The details you give us must be correct.</li>
      </ul>
    `],
    ['trial', 'Free trial', `
      <p>Every plan starts with a free trial (currently 14 days). No card is needed. When the trial ends, the workspace becomes read-only: you can still view and export your records, but you cannot add or change them until you choose a paid plan.</p>
    `],
    ['payment', 'Plans, prices and payment', `
      <ul>
        <li>Prices are in Indian Rupees and are shown per month or per year. Taxes such as GST are added where applicable.</li>
        <li>You pay in advance for one month or one year, by UPI, bank transfer or online payment (Razorpay). Paying before the end of a period adds the new period after the current one.</li>
        <li>We do not charge you automatically. If a paid period ends without renewal, the workspace becomes read-only until you pay again. We email the workspace admins before the end date.</li>
        <li>We may change prices. A new price applies from your next payment after we give you at least 30 days’ notice. The period you have already paid for is not affected.</li>
      </ul>
    `],
    ['refunds', 'Cancellation and refunds', `
      <ul>
        <li>You can stop using UXONIC Books at any time. Simply do not renew; nothing more is charged.</li>
        <li>Because every plan starts with a free trial, payments for a period that has started are not refundable.</li>
        <li>If you were charged twice or by mistake, write to ${CONTACT} within 30 days. We refund the extra amount to the original payment method within 7 working days of confirming it.</li>
        <li>If we end the service for reasons other than a breach of these terms, we refund the unused part of your paid period.</li>
      </ul>
    `],
    ['data', 'Your data', `
      <ul>
        <li>Everything your business enters belongs to your business. You give us permission to store and process it only to provide the service, as described in our <a href="/privacy/">Privacy Policy</a>.</li>
        <li>You can export your records while your account is active, and for 30 days after it ends.</li>
        <li>You are responsible for having the right to add personal data about your customers and employees, and for using it lawfully.</li>
      </ul>
    `],
    ['use', 'Acceptable use', `
      <p>Do not use UXONIC Books to:</p>
      <ul>
        <li>break the law, or send spam or misleading messages;</li>
        <li>store content you have no right to;</li>
        <li>try to get into other workspaces or our systems;</li>
        <li>overload, copy, resell or reverse-engineer the service.</li>
      </ul>
      <p>We may suspend a workspace that does any of these. Where possible, we warn you first.</p>
    `],
    ['documents', 'Invoices and tax', `
      <p>UXONIC Books helps you create quotations and GST invoices, work out taxes and track stock and attendance. You remain responsible for the accuracy of the documents you issue, for your tax filings, and for following the laws that apply to your business. Please check important figures with your accountant.</p>
    `],
    ['availability', 'Availability and support', `
      <p>We work to keep UXONIC Books available and fast, but we cannot promise it will never be interrupted, for example during maintenance or problems with our providers. Support is available by email at ${CONTACT}, on WhatsApp at +91 98430 21717 and from Help in the app, on working days.</p>
    `],
    ['liability', 'Limitation of liability', `
      <p>The service is provided “as is”. To the extent the law allows:</p>
      <ul>
        <li>UXONIC is not liable for indirect losses, such as lost profit or lost business.</li>
        <li>UXONIC’s total liability for any claim is limited to the amount you paid us in the 12 months before the claim.</li>
      </ul>
      <p>Nothing here limits liability that cannot be limited under Indian law.</p>
    `],
    ['ending', 'Ending the agreement', `
      <p>You may close your workspace at any time by writing to ${CONTACT}. We may end or suspend your access if you seriously or repeatedly break these terms, or if a paid period has ended without renewal. When a workspace is closed, its records are deleted as described in the <a href="/privacy/">Privacy Policy</a>.</p>
    `],
    ['law', 'Law and disputes', `
      <p>These terms are governed by the laws of India. We will first try to resolve any dispute by talking with you. If that does not work, the courts at Tiruchirappalli, Tamil Nadu have jurisdiction.</p>
    `],
    ['changes', 'Changes to these terms', `
      <p>We may update these terms. For important changes we will tell workspace admins by email or in the app at least 30 days before they apply. If you keep using the service after that, you accept the new terms.</p>
    `],
    ['contact', 'Contact', `
      <p>UXONIC Digital Solutions, Trichy &amp; Karur, Tamil Nadu, India.</p>
      <p>Email ${CONTACT} or WhatsApp +91 98430 21717.</p>
    `],
  ],
});

for (const [dir, html] of [['privacy', privacy], ['terms', terms]]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
}
console.log('ok');
