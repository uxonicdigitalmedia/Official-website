// Shared Resend email helper
const RESEND_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'uxonicdigitalmedia@gmail.com';
// Verified domain sender preferred; falls back to Resend onboarding address
const FROM = process.env.RESEND_FROM || 'UXONIC Digital <onboarding@resend.dev>';

export function getAdminEmail() {
  return ADMIN_EMAIL;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_KEY) {
    console.error('RESEND_API_KEY missing — email not sent:', subject);
    return { ok: false, error: 'Email service not configured.' };
  }

  const recipients = Array.isArray(to) ? to : [to || ADMIN_EMAIL];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject,
        html,
        text: text || undefined,
        reply_to: ADMIN_EMAIL,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error:', body);
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
  <div style="font-family:Inter,system-ui,sans-serif;background:#0B1325;padding:40px 20px;">
    <div style="max-width:440px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.25);border-radius:20px;padding:40px 36px;">
      <p style="font-family:serif;font-size:1.6rem;font-weight:900;color:#D4AF37;letter-spacing:.12em;margin:0;text-align:center;">UXONIC</p>
      <p style="font-size:.75rem;color:#64748B;letter-spacing:.1em;text-transform:uppercase;margin:4px 0 28px;text-align:center;">Admin Panel</p>
      <h1 style="font-size:1.1rem;font-weight:700;color:#fff;text-align:center;margin:0 0 8px;">Your Login OTP</h1>
      <p style="font-size:.88rem;color:#94A3B8;text-align:center;margin:0 0 28px;">Use this code to sign in. Valid for 10 minutes.</p>
      <div style="background:rgba(212,175,55,0.08);border:2px solid rgba(212,175,55,0.35);border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="font-size:2.8rem;font-weight:900;letter-spacing:.28em;color:#D4AF37;margin:0;font-family:monospace;">${otp}</p>
      </div>
      <p style="font-size:.75rem;color:#64748B;text-align:center;margin:0;">If you did not request this, ignore this email.<br/>© 2026 UXONIC Digital Solutions</p>
    </div>
  </div>`;
}

export function applicationNotifyHtml(app) {
  const rows = [
    ['Name', app.full_name],
    ['Email', app.email],
    ['Mobile', app.mobile],
    ['Location', app.location],
    ['Job / Role', app.job_title || 'Internship / General'],
    ['College', app.college || '—'],
    ['Degree', app.degree || '—'],
    ['Grad Year', app.grad_year || '—'],
    ['Sales Exp', app.sales_exp || '—'],
    ['LinkedIn', app.linkedin || '—'],
    ['Why UXONIC', app.why_uxonic || '—'],
    ['Resume', app.resume_name || 'Attached in admin'],
    ['Application ID', app.id],
  ].map(([k, v]) =>
    `<tr><td style="padding:8px 12px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,.06);width:140px;">${k}</td>
     <td style="padding:8px 12px;color:#fff;border-bottom:1px solid rgba(255,255,255,.06);">${String(v).replace(/</g,'&lt;')}</td></tr>`
  ).join('');

  return `
  <div style="font-family:Inter,system-ui,sans-serif;background:#0B1325;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.25);border-radius:16px;padding:28px;">
      <p style="font-family:serif;font-size:1.3rem;font-weight:900;color:#D4AF37;margin:0 0 4px;">UXONIC</p>
      <h1 style="font-size:1.05rem;color:#fff;margin:0 0 6px;">New job application received</h1>
      <p style="font-size:.85rem;color:#94A3B8;margin:0 0 20px;">Open Admin → Applications to review.</p>
      <table style="width:100%;border-collapse:collapse;font-size:.88rem;">${rows}</table>
      <p style="margin:20px 0 0;"><a href="https://www.uxonicdigital.com/admin/applications" style="display:inline-block;background:#D4AF37;color:#0B1325;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none;">Open Admin Panel</a></p>
    </div>
  </div>`;
}

export function contactNotifyHtml(c) {
  return `
  <div style="font-family:Inter,system-ui,sans-serif;background:#0B1325;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#0F172A;border:1.5px solid rgba(212,175,55,0.25);border-radius:16px;padding:28px;">
      <p style="font-family:serif;font-size:1.3rem;font-weight:900;color:#D4AF37;margin:0 0 4px;">UXONIC</p>
      <h1 style="font-size:1.05rem;color:#fff;margin:0 0 16px;">New contact message</h1>
      <p style="color:#94A3B8;font-size:.88rem;margin:0 0 8px;"><strong style="color:#fff;">${c.full_name}</strong> · ${c.email}</p>
      <p style="color:#94A3B8;font-size:.88rem;margin:0 0 12px;">Project: ${c.project_type || '—'}</p>
      <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.9rem;white-space:pre-wrap;">${String(c.message||'').replace(/</g,'&lt;')}</div>
      <p style="margin:20px 0 0;"><a href="https://www.uxonicdigital.com/admin/contacts" style="display:inline-block;background:#D4AF37;color:#0B1325;padding:10px 18px;border-radius:8px;font-weight:700;text-decoration:none;">View in Admin</a></p>
    </div>
  </div>`;
}
