// Vercel Function: POST /api/apply
// Handles internship application form submission + resume upload to Supabase Storage
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { getSupabase } from './_lib/supabase.js';
import { handleOptions, json } from './_lib/cors.js';
import { sendEmail, applicationNotifyHtml, applicationConfirmationHtml, getAdminEmail } from './_lib/email.js';

export const config = { api: { bodyParser: false } }; // formidable needs raw stream

// ── Rate limit (simple in-memory — resets on cold start) ──────
const rateLimitMap = new Map();
function rateLimit(ip, max = 5, windowMs = 3600000) {
  const now    = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - record.start > windowMs) { record.count = 0; record.start = now; }
  record.count++;
  rateLimitMap.set(ip, record);
  return record.count > max;
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown';
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);

  const ip = getIp(req);
  if (rateLimit(ip)) return json(res, 429, { success: false, message: 'Too many submissions. Try again later.' }, req);

  // ── Parse multipart form ──────────────────────────────────────
  const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024, keepExtensions: true });

  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
    });
  } catch (err) {
    return json(res, 400, { success: false, message: 'Form parse error: ' + err.message }, req);
  }

  const g = (k) => (Array.isArray(fields[k]) ? fields[k][0] : fields[k] || '').toString().trim();

  // ── Validate required fields ──────────────────────────────────
  const errors = [];
  const fullName = g('fullName');
  const email    = g('email');
  const mobile   = g('mobile');
  const location = g('location');

  if (fullName.length < 2)                                    errors.push('Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))            errors.push('Valid email is required.');
  if (!/^[+0-9\s\-().]{7,15}$/.test(mobile))                errors.push('Valid mobile number is required.');
  if (location.length < 2)                                   errors.push('Location is required.');

  const linkedin = g('linkedin');
  if (linkedin) {
    try { new URL(linkedin); } catch { errors.push('LinkedIn URL is not valid.'); }
  }

  const gradYear = g('gradYear');
  if (gradYear && !/^\d{4}$/.test(gradYear)) errors.push('Graduation year must be 4 digits.');

  // ── Validate resume file ──────────────────────────────────────
  const resumeFile = Array.isArray(files.resume) ? files.resume[0] : files.resume;
  if (!resumeFile) {
    errors.push('Resume (PDF) is required.');
  } else {
    const ext  = path.extname(resumeFile.originalFilename || '').toLowerCase();
    const mime = resumeFile.mimetype || '';
    if (ext !== '.pdf' || mime !== 'application/pdf') {
      errors.push('Only PDF files are accepted for the resume.');
    }
    if (resumeFile.size > 5 * 1024 * 1024) {
      errors.push('Resume file is too large. Maximum 5 MB.');
    }
    // Verify PDF magic bytes
    if (!errors.length) {
      const buf = Buffer.alloc(4);
      const fd  = fs.openSync(resumeFile.filepath, 'r');
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      if (buf.toString() !== '%PDF') errors.push('File does not appear to be a valid PDF.');
    }
  }

  if (errors.length) return json(res, 422, { success: false, message: errors.join(' '), errors }, req);

  const supabase = getSupabase();

  // ── Upload resume to Supabase Storage ────────────────────────
  let resumePath = null;
  let resumeName = null;

  if (resumeFile) {
    const safeName  = (resumeFile.originalFilename || 'resume.pdf')
                        .replace(/[^a-zA-Z0-9_\-.]/g, '_')
                        .slice(0, 100);
    const unique    = `${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
    const fileBytes = fs.readFileSync(resumeFile.filepath);

    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(unique, fileBytes, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('Resume upload error:', uploadError);
      return json(res, 500, { success: false, message: 'Resume upload failed. Please try again.' }, req);
    }

    resumePath = unique;
    resumeName = safeName;

    // Clean up temp file
    try { fs.unlinkSync(resumeFile.filepath); } catch {}
  }

  // ── Save to Supabase DB ───────────────────────────────────────
  const salesExp = ['Yes','No'].includes(g('salesExp')) ? g('salesExp') : 'No';
  const jobTitle = (g('jobTitle') || g('job_title') || '').slice(0, 200);
  let whyText = g('whyUxonic').slice(0, 2800) || '';
  if (jobTitle) whyText = `[Applied for: ${jobTitle}]\n${whyText}`.slice(0, 3000);

  const { data, error: dbError } = await supabase
    .from('internship_applications')
    .insert({
      full_name:   fullName,
      email,
      mobile,
      location,
      college:     g('college')  || null,
      degree:      g('degree')   || null,
      grad_year:   gradYear      || null,
      sales_exp:   salesExp,
      linkedin:    linkedin      || null,
      why_uxonic:  whyText || null,
      resume_path: resumePath,
      resume_name: resumeName,
      status:      'new',
      ip_address:  ip,
    })
    .select('id')
    .single();

  if (dbError) {
    console.error('DB insert error:', dbError);
    if (resumePath) await supabase.storage.from('resumes').remove([resumePath]);
    return json(res, 500, { success: false, message: 'Submission failed. Please try again.' }, req);
  }

  // ── Send Email Notifications ─────────────────────────────────
  const adminEmail = getAdminEmail();
  const emailTasks = [
    // 1. Notify Admin (uxonicdigitalmedia@gmail.com)
    sendEmail({
      to: adminEmail,
      subject: `New Application: ${fullName}${jobTitle ? ' — ' + jobTitle : ''}`,
      html: applicationNotifyHtml({
        id: data.id,
        full_name: fullName,
        email,
        mobile,
        location,
        job_title: jobTitle || 'Internship / General Apply',
        college: g('college'),
        degree: g('degree'),
        grad_year: gradYear,
        sales_exp: salesExp,
        linkedin,
        why_uxonic: whyText,
        resume_name: resumeName,
      }),
      reply_to: email, // Admin can click reply to email the candidate directly
    }),
  ];

  // 2. Thank you confirmation to Applicant
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailTasks.push(
      sendEmail({
        to: email,
        subject: `Application Received — ${jobTitle || 'UXONIC Digital Solutions'}`,
        html: applicationConfirmationHtml({
          id: data.id,
          full_name: fullName,
          job_title: jobTitle || 'Internship / General Apply',
          mobile,
        }),
        reply_to: adminEmail, // Candidate replies to official admin email
      })
    );
  }

  // Await in serverless function so Vercel doesn't terminate early
  const emailResults = await Promise.allSettled(emailTasks);
  emailResults.forEach((res, i) => {
    if (res.status === 'rejected' || (res.value && !res.value.ok)) {
      console.warn(`Apply email ${i === 0 ? 'Admin Notify' : 'Applicant Confirmation'} status:`, res.reason || res.value?.error);
    }
  });

  return json(res, 200, {
    success: true,
    message: 'Application submitted successfully.',
    id: data.id,
  }, req);
}
