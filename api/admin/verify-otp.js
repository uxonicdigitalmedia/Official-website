// POST /api/admin/verify-otp
// Validates OTP, returns JWT token
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { signToken } from '../_lib/auth.js';
import crypto from 'crypto';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'uxonicdigitalmedia@gmail.com';

// Rate limit: max 5 verify attempts per 10 minutes per IP
const rateMap = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const r   = rateMap.get(ip) || { count: 0, start: now };
  if (now - r.start > 600000) { r.count = 0; r.start = now; }
  r.count++;
  rateMap.set(ip, r);
  return r.count > 5;
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);

  try {
    const ip = getIp(req);
    if (rateLimit(ip)) return json(res, 429, { success: false, message: 'Too many attempts. Wait 10 minutes.' }, req);

    const { email, otp } = req.body || {};

    if (!email || !otp) return json(res, 400, { success: false, message: 'Email and OTP required.' }, req);

    // Only allow admin email
    if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return json(res, 401, { success: false, message: 'Invalid OTP.' }, req);
    }

    // Sanitise OTP — must be 6 digits
    const cleanOtp = String(otp).replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) return json(res, 400, { success: false, message: 'OTP must be 6 digits.' }, req);

    const otpHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    const sb      = getSupabase();

    // Find valid unused OTP
    const { data: rows, error } = await sb
      .from('admin_otps')
      .select('id, expires_at, used')
      .eq('email', ADMIN_EMAIL)
      .eq('otp_hash', otpHash)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !rows || rows.length === 0) {
      return json(res, 401, { success: false, message: 'Invalid OTP. Please request a new one.' }, req);
    }

    const record = rows[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return json(res, 401, { success: false, message: 'OTP has expired. Please request a new one.' }, req);
    }

    // Mark OTP as used
    await sb.from('admin_otps').update({ used: true }).eq('id', record.id);

    // Clean up old OTPs for this email
    await sb.from('admin_otps')
      .delete()
      .eq('email', ADMIN_EMAIL)
      .lt('expires_at', new Date().toISOString());

    // Issue JWT
    const token = signToken({
      email:    ADMIN_EMAIL,
      role:     'superadmin',
      name:     'UXONIC Admin',
    });

    return json(res, 200, {
      success: true,
      token,
      admin: {
        email:     ADMIN_EMAIL,
        full_name: 'UXONIC Admin',
        role:      'superadmin',
      },
    }, req);
  } catch (err) {
    console.error('verify-otp exception:', err);
    return json(res, 500, { success: false, message: err.message || 'Server error verifying OTP.' }, req);
  }
}
