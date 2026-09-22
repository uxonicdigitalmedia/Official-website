// POST /api/admin/send-otp
// Generates a 6-digit OTP, stores hashed in Supabase, sends via Resend
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { sendEmail, otpEmailHtml, getAdminEmail } from '../_lib/email.js';
import crypto from 'crypto';

const ADMIN_EMAIL = getAdminEmail();

// Rate limit: max 3 OTP requests per 10 minutes per IP
const rateMap = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const r   = rateMap.get(ip) || { count: 0, start: now };
  if (now - r.start > 600000) { r.count = 0; r.start = now; }
  r.count++;
  rateMap.set(ip, r);
  return r.count > 3;
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);

  try {
    const ip = getIp(req);
    if (rateLimit(ip)) return json(res, 429, { success: false, message: 'Too many OTP requests. Wait 10 minutes.' }, req);

    const { email } = req.body || {};

    if (!email || email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return json(res, 200, { success: true, message: 'If this email is authorised, an OTP has been sent.' }, req);
    }

    const otp     = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const sb = getSupabase();

    await sb.from('admin_otps')
      .update({ used: true })
      .eq('email', ADMIN_EMAIL)
      .eq('used', false);

    const { error: dbErr } = await sb.from('admin_otps').insert({
      email:      ADMIN_EMAIL,
      otp_hash:   otpHash,
      expires_at: expires.toISOString(),
      used:       false,
    });

    if (dbErr) {
      console.error('OTP DB error:', dbErr);
      return json(res, 500, { success: false, message: dbErr.message || 'Database error: Failed to save OTP. Check if admin_otps table exists.' }, req);
    }

    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `${otp} is your UXONIC Admin OTP`,
      html: otpEmailHtml(otp),
      text: `Your UXONIC Admin OTP is ${otp}. It expires in 10 minutes.`,
    });

    if (!sent.ok) {
      return json(res, 500, { success: false, message: sent.error || 'Failed to send OTP email via Resend.' }, req);
    }

    console.log(`OTP emailed to ${ADMIN_EMAIL} (resend id: ${sent.id})`);
    return json(res, 200, { success: true, message: 'OTP sent to your registered email.' }, req);
  } catch (err) {
    console.error('send-otp exception:', err);
    return json(res, 500, { success: false, message: err.message || 'Server error occurred while sending OTP.' }, req);
  }
}
