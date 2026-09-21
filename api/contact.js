// Vercel Function: POST /api/contact
// Handles main website contact form submission
import { getSupabase } from './_lib/supabase.js';
import { handleOptions, json } from './_lib/cors.js';
import { sendEmail, contactNotifyHtml, getAdminEmail } from './_lib/email.js';

const rateLimitMap = new Map();
function rateLimit(ip, max = 3, windowMs = 3600000) {
  const now    = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - record.start > windowMs) { record.count = 0; record.start = now; }
  record.count++;
  rateLimitMap.set(ip, record);
  return record.count > max;
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);

  const ip = getIp(req);
  if (rateLimit(ip)) return json(res, 429, { success: false, message: 'Too many requests. Try again later.' }, req);

  // Parse JSON or form body
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(await getRawBody(req)); } catch { body = {}; }
  }

  const clean = (k, max = 255) => String(body[k] || '').trim().slice(0, max);

  const fullName    = clean('name', 160);
  const email       = clean('email', 180);
  const projectType = clean('project_type', 120);
  const message     = clean('message', 3000);

  const errors = [];
  if (fullName.length < 2)                         errors.push('Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  errors.push('Valid email is required.');
  if (message.length < 3)                          errors.push('Message is required.');

  if (errors.length) return json(res, 422, { success: false, message: errors.join(' '), errors }, req);

  // Honeypot check
  if (body.website) return json(res, 200, { success: true, message: 'Message received.' }, req);

  const { error } = await getSupabase()
    .from('contact_submissions')
    .insert({
      full_name:    fullName,
      email,
      project_type: projectType || null,
      message,
      is_read:      false,
      ip_address:   ip,
    });

  if (error) {
    console.error('Contact DB error:', error);
    return json(res, 500, { success: false, message: 'Server error. Please try again.' }, req);
  }

  sendEmail({
    to: getAdminEmail(),
    subject: `New contact: ${fullName}${projectType ? ' — ' + projectType : ''}`,
    html: contactNotifyHtml({
      full_name: fullName,
      email,
      project_type: projectType,
      message,
    }),
  }).catch(err => console.error('Contact notify failed:', err));

  return json(res, 200, { success: true, message: "Message received. We'll get back to you within 24 hours." }, req);
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
