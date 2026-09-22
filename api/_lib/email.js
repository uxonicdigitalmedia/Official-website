// Shared Resend email helper
const RESEND_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'uxonicdigitalmedia@gmail.com';
// Verified domain sender preferred; falls back to Resend onboarding address
const FROM = process.env.RESEND_FROM || 'UXONIC Digital <onboarding@resend.dev>';

export function getAdminEmail() {
  return ADMIN_EMAIL;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendEmail({ to, subject, html, text, reply_to }) {
  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY missing — email not sent:', subject);
    return { ok: false, error: 'RESEND_API_KEY not configured.' };
  }

  const recipients = Array.isArray(to) ? to : [to || ADMIN_EMAIL];

  try {
    const payload = {
      from: FROM,
      to: recipients,
      subject,
      html,
      text: text || undefined,
      reply_to: reply_to || ADMIN_EMAIL,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error (' + res.status + '):', body);
      return { ok: false, error: body.message || 'Send failed', body };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    console.error('Email send exception:', err);
    return { ok: false, error: err.message };
  }
}

export function otpEmailHtml(otp) {
  return `
  <div style="font-family:Inter,system-ui,sans-serif;background:#070C18;padding:40px 20px;">
    <div style="max-width:440px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.3);border-radius:20px;padding:40px 36px;box-shadow:0 12px 40px rgba(0,0,0,0.5);">
      <p style="font-family:serif;font-size:1.6rem;font-weight:900;color:#D4AF37;letter-spacing:.12em;margin:0;text-align:center;">UXONIC</p>
      <p style="font-size:.75rem;color:#64748B;letter-spacing:.1em;text-transform:uppercase;margin:4px 0 28px;text-align:center;">Admin Panel Security</p>
      <h1 style="font-size:1.15rem;font-weight:700;color:#fff;text-align:center;margin:0 0 8px;">Your Login Verification Code</h1>
      <p style="font-size:.88rem;color:#94A3B8;text-align:center;margin:0 0 28px;">Use this one-time code to authenticate your session. Valid for 10 minutes.</p>
      <div style="background:rgba(212,175,55,0.08);border:2px solid rgba(212,175,55,0.4);border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="font-size:2.8rem;font-weight:900;letter-spacing:.28em;color:#D4AF37;margin:0;font-family:monospace;">${esc(otp)}</p>
      </div>
      <p style="font-size:.75rem;color:#64748B;text-align:center;margin:0;line-height:1.5;">If you did not request this, please ignore this email.<br/>© 2026 UXONIC Digital Solutions</p>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────
// 1. ADMIN NOTIFICATION: Job / Internship Application
// ────────────────────────────────────────────────────────────────
export function applicationNotifyHtml(app) {
  const rows = [
    ['Candidate Name', app.full_name],
    ['Email', `<a href="mailto:${esc(app.email)}" style="color:#D4AF37;text-decoration:none;">${esc(app.email)}</a>`],
    ['Mobile / WhatsApp', `<a href="tel:${esc(app.mobile)}" style="color:#D4AF37;text-decoration:none;">${esc(app.mobile)}</a>`],
    ['Role Applied For', `<strong style="color:#fff;">${esc(app.job_title || 'Internship / General Apply')}</strong>`],
    ['Location', app.location],
    ['College / University', app.college || '—'],
    ['Degree / Stream', app.degree || '—'],
    ['Graduation Year', app.grad_year || '—'],
    ['Sales / Prior Exp', app.sales_exp || '—'],
    ['LinkedIn Profile', app.linkedin ? `<a href="${esc(app.linkedin)}" target="_blank" style="color:#D4AF37;text-decoration:underline;">View Profile ↗</a>` : '—'],
    ['Why UXONIC / Pitch', app.why_uxonic ? `<div style="max-height:160px;overflow-y:auto;white-space:pre-wrap;background:rgba(255,255,255,0.04);padding:8px 12px;border-radius:6px;font-size:.84rem;color:#E2E8F0;">${esc(app.why_uxonic)}</div>` : '—'],
    ['Resume File', app.resume_name || 'Stored in Supabase'],
    ['Application ID', `<code style="background:rgba(212,175,55,0.12);color:#D4AF37;padding:2px 6px;border-radius:4px;font-size:.8rem;">${esc(app.id)}</code>`],
  ].map(([k, v]) =>
    `<tr>
      <td style="padding:10px 14px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,0.07);width:150px;font-size:0.85rem;vertical-align:top;">${k}</td>
      <td style="padding:10px 14px;color:#F1F5F9;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.88rem;vertical-align:top;">${v}</td>
    </tr>`
  ).join('');

  return `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#070C18;padding:36px 16px;color:#F1F5F9;">
    <div style="max-width:580px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.3);border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.5);">
      <div style="background:linear-gradient(135deg,rgba(212,175,55,0.15),transparent);padding:24px 28px;border-bottom:1px solid rgba(212,175,55,0.2);">
        <p style="font-family:serif;font-size:1.35rem;font-weight:900;color:#D4AF37;letter-spacing:.08em;margin:0 0 6px;">UXONIC</p>
        <h1 style="font-size:1.15rem;font-weight:700;color:#fff;margin:0 0 4px;">🚀 New Job Application Received</h1>
        <p style="font-size:.85rem;color:#94A3B8;margin:0;">A new candidate has submitted their application through the careers portal.</p>
      </div>

      <div style="padding:24px 28px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          ${rows}
        </table>

        <div style="text-align:center;padding-top:8px;">
          <a href="https://www.uxonicdigital.com/admin/applications" style="display:inline-block;background:#D4AF37;color:#070C18;font-weight:700;padding:12px 26px;border-radius:10px;text-decoration:none;font-size:.9rem;box-shadow:0 4px 16px rgba(212,175,55,0.3);">
            Review in Admin Panel →
          </a>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.25);padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:.78rem;color:#64748B;text-align:center;">
        You can click "Reply" in your email client to reply directly to <strong style="color:#94A3B8;">${esc(app.email)}</strong>.
      </div>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────
// 2. APPLICANT CONFIRMATION: Thank you for applying
// ────────────────────────────────────────────────────────────────
export function applicationConfirmationHtml(app) {
  const roleTitle = app.job_title || 'Job / Internship';
  const candidateName = app.full_name || 'Candidate';

  return `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#070C18;padding:36px 16px;color:#F1F5F9;">
    <div style="max-width:560px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.3);border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.5);">
      <div style="background:linear-gradient(135deg,rgba(212,175,55,0.18),transparent);padding:28px 28px 20px;border-bottom:1px solid rgba(212,175,55,0.2);text-align:center;">
        <p style="font-family:serif;font-size:1.6rem;font-weight:900;color:#D4AF37;letter-spacing:.12em;margin:0 0 6px;">UXONIC</p>
        <p style="font-size:.78rem;color:#94A3B8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px;">Digital Solutions</p>
        <h1 style="font-size:1.22rem;font-weight:700;color:#fff;margin:0 0 6px;">Application Received — Thank You!</h1>
      </div>

      <div style="padding:28px;">
        <p style="font-size:.96rem;color:#F1F5F9;margin:0 0 16px;line-height:1.6;">
          Dear <strong style="color:#D4AF37;">${esc(candidateName)}</strong>,
        </p>

        <p style="font-size:.92rem;color:#CBD5E1;line-height:1.65;margin:0 0 18px;">
          Thank you for applying for the <strong style="color:#fff;">${esc(roleTitle)}</strong> opportunity at <strong style="color:#D4AF37;">UXONIC Digital Solutions</strong>. We appreciate the time and effort you took to submit your application.
        </p>

        <div style="background:rgba(212,175,55,0.06);border-left:3px solid #D4AF37;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
          <p style="font-size:.88rem;color:#E2E8F0;margin:0 0 8px;font-weight:600;">📋 What happens next?</p>
          <ul style="margin:0;padding-left:18px;font-size:.84rem;color:#94A3B8;line-height:1.6;">
            <li>Our Talent Acquisition team will carefully review your credentials and resume.</li>
            <li>If your profile matches our requirements, we will contact you within <strong style="color:#fff;">2 to 3 business days</strong> for the next round.</li>
            <li>Please keep an eye on your email inbox and phone.</li>
          </ul>
        </div>

        <p style="font-size:.9rem;color:#94A3B8;line-height:1.6;margin:20px 0 24px;">
          In the meantime, learn more about our company and projects by visiting our official website:
        </p>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="https://www.uxonicdigital.com" style="display:inline-block;background:#D4AF37;color:#070C18;font-weight:700;padding:11px 24px;border-radius:10px;text-decoration:none;font-size:.88rem;box-shadow:0 4px 16px rgba(212,175,55,0.3);">
            Explore UXONIC Digital ↗
          </a>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;">
          <p style="font-size:.86rem;color:#CBD5E1;margin:0 0 4px;font-weight:600;">Warm regards,</p>
          <p style="font-size:.88rem;color:#D4AF37;font-weight:700;margin:0 0 2px;">Talent Acquisition Team</p>
          <p style="font-size:.8rem;color:#64748B;margin:0;">UXONIC Digital Solutions<br/>✉️ <a href="mailto:uxonicdigitalmedia@gmail.com" style="color:#94A3B8;text-decoration:none;">uxonicdigitalmedia@gmail.com</a> | 🌐 <a href="https://www.uxonicdigital.com" style="color:#94A3B8;text-decoration:none;">uxonicdigital.com</a></p>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.25);padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:.76rem;color:#64748B;text-align:center;">
        © 2026 UXONIC Digital Solutions. All rights reserved.
      </div>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────
// 3. ADMIN NOTIFICATION: Contact Form Message
// ────────────────────────────────────────────────────────────────
export function contactNotifyHtml(c) {
  return `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#070C18;padding:36px 16px;color:#F1F5F9;">
    <div style="max-width:540px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.3);border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.5);">
      <div style="background:linear-gradient(135deg,rgba(212,175,55,0.15),transparent);padding:24px 28px;border-bottom:1px solid rgba(212,175,55,0.2);">
        <p style="font-family:serif;font-size:1.35rem;font-weight:900;color:#D4AF37;letter-spacing:.08em;margin:0 0 6px;">UXONIC</p>
        <h1 style="font-size:1.15rem;font-weight:700;color:#fff;margin:0 0 4px;">💬 New Contact Inquiry</h1>
        <p style="font-size:.85rem;color:#94A3B8;margin:0;">A client or visitor sent a message through the website contact form.</p>
      </div>

      <div style="padding:24px 28px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:10px 14px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,0.07);width:130px;font-size:0.85rem;">Client Name</td>
            <td style="padding:10px 14px;color:#F1F5F9;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.88rem;font-weight:600;">${esc(c.full_name)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.85rem;">Email Address</td>
            <td style="padding:10px 14px;color:#F1F5F9;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.88rem;">
              <a href="mailto:${esc(c.email)}" style="color:#D4AF37;text-decoration:none;">${esc(c.email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.85rem;">Project / Topic</td>
            <td style="padding:10px 14px;color:#F1F5F9;border-bottom:1px solid rgba(255,255,255,0.07);font-size:0.88rem;">${esc(c.project_type || 'General Inquiry')}</td>
          </tr>
        </table>

        <p style="font-size:.85rem;color:#94A3B8;margin:0 0 8px;font-weight:600;">Message Content:</p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;color:#E2E8F0;font-size:.9rem;line-height:1.6;white-space:pre-wrap;margin-bottom:24px;">
${esc(c.message)}
        </div>

        <div style="text-align:center;">
          <a href="https://www.uxonicdigital.com/admin/contacts" style="display:inline-block;background:#D4AF37;color:#070C18;font-weight:700;padding:11px 24px;border-radius:10px;text-decoration:none;font-size:.88rem;box-shadow:0 4px 16px rgba(212,175,55,0.3);">
            Open in Admin Panel →
          </a>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.25);padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:.78rem;color:#64748B;text-align:center;">
        Click "Reply" to answer directly to <strong style="color:#94A3B8;">${esc(c.email)}</strong>.
      </div>
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────
// 4. CLIENT CONFIRMATION: Thank you for contacting UXONIC
// ────────────────────────────────────────────────────────────────
export function contactConfirmationHtml(c) {
  const senderName = c.full_name || 'Valued Client';
  const projectType = c.project_type || 'Digital Services';

  return `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif;background:#070C18;padding:36px 16px;color:#F1F5F9;">
    <div style="max-width:540px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.3);border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.5);">
      <div style="background:linear-gradient(135deg,rgba(212,175,55,0.18),transparent);padding:28px 28px 20px;border-bottom:1px solid rgba(212,175,55,0.2);text-align:center;">
        <p style="font-family:serif;font-size:1.6rem;font-weight:900;color:#D4AF37;letter-spacing:.12em;margin:0 0 6px;">UXONIC</p>
        <p style="font-size:.78rem;color:#94A3B8;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px;">Digital Solutions</p>
        <h1 style="font-size:1.22rem;font-weight:700;color:#fff;margin:0 0 6px;">Thank You for Reaching Out!</h1>
      </div>

      <div style="padding:28px;">
        <p style="font-size:.96rem;color:#F1F5F9;margin:0 0 16px;line-height:1.6;">
          Hi <strong style="color:#D4AF37;">${esc(senderName)}</strong>,
        </p>

        <p style="font-size:.92rem;color:#CBD5E1;line-height:1.65;margin:0 0 18px;">
          Thank you for connecting with <strong style="color:#D4AF37;">UXONIC Digital Solutions</strong>! We have received your inquiry regarding <strong style="color:#fff;">${esc(projectType)}</strong>.
        </p>

        <p style="font-size:.9rem;color:#94A3B8;line-height:1.65;margin:0 0 20px;">
          Our strategy and tech specialists are currently reviewing your project details. We will get back to you within <strong style="color:#fff;">24 hours</strong> with tailored insights or to arrange a short discovery call.
        </p>

        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin:20px 0;">
          <p style="font-size:.82rem;color:#D4AF37;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin:0 0 8px;">A copy of your message:</p>
          <div style="font-size:.88rem;color:#E2E8F0;line-height:1.55;white-space:pre-wrap;">${esc(c.message)}</div>
        </div>

        <div style="background:rgba(212,175,55,0.06);border-left:3px solid #D4AF37;border-radius:0 10px 10px 0;padding:14px 18px;margin:22px 0;">
          <p style="font-size:.86rem;color:#E2E8F0;margin:0 0 4px;font-weight:600;">⚡ Need an urgent response?</p>
          <p style="font-size:.82rem;color:#94A3B8;margin:0;">
            Chat directly with our team on WhatsApp: <a href="https://wa.me/919843021717" target="_blank" style="color:#D4AF37;text-decoration:underline;">+91 98430 21717 ↗</a>
          </p>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;margin-top:24px;">
          <p style="font-size:.86rem;color:#CBD5E1;margin:0 0 4px;font-weight:600;">Best regards,</p>
          <p style="font-size:.88rem;color:#D4AF37;font-weight:700;margin:0 0 2px;">The UXONIC Team</p>
          <p style="font-size:.8rem;color:#64748B;margin:0;">
            UXONIC Digital Solutions<br/>
            ✉️ <a href="mailto:uxonicdigitalmedia@gmail.com" style="color:#94A3B8;text-decoration:none;">uxonicdigitalmedia@gmail.com</a> | 🌐 <a href="https://www.uxonicdigital.com" style="color:#94A3B8;text-decoration:none;">uxonicdigital.com</a>
          </p>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.25);padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:.76rem;color:#64748B;text-align:center;">
        © 2026 UXONIC Digital Solutions. All rights reserved.
      </div>
    </div>
  </div>`;
}

