// GET/POST/PUT/DELETE /api/admin/jobs
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

const VALID_TYPES   = ['full-time','part-time','internship','contract','freelance'];
const VALID_STATUS  = ['draft','active','closed'];

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const admin = requireAuth(req, res);
  if (!admin) return;

  const sb = getSupabase();

  if (req.method === 'GET') {
    const { id, status } = req.query;
    if (id) {
      const { data, error } = await sb.from('job_postings').select('*').eq('id', id).single();
      if (error) return json(res, 404, { success: false, message: 'Not found.' }, req);
      return json(res, 200, { success: true, job: data }, req);
    }
    let query = sb.from('job_postings').select('*');
    if (status && VALID_STATUS.includes(status)) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, jobs: data }, req);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title?.trim()) return json(res, 400, { success: false, message: 'Title is required.' }, req);
    const payload = {
      title:            b.title.trim().slice(0,220),
      department:       (b.department||'').trim().slice(0,120)||null,
      location:         (b.location||'Remote / Tamil Nadu').trim().slice(0,160),
      job_type:         VALID_TYPES.includes(b.job_type) ? b.job_type : 'full-time',
      experience:       (b.experience||'').trim().slice(0,100)||null,
      salary:           (b.salary||'').trim().slice(0,120)||null,
      description:      (b.description||'').trim()||null,
      requirements:     (b.requirements||'').trim()||null,
      responsibilities: (b.responsibilities||'').trim()||null,
      skills:           (b.skills||'').trim().slice(0,300)||null,
      apply_url:        (b.apply_url||'').trim().slice(0,300)||null,
      status:           VALID_STATUS.includes(b.status) ? b.status : 'draft',
      expires_at:       b.expires_at || null,
    };
    if (payload.status === 'active') payload.posted_at = new Date().toISOString();
    // Only set created_by when JWT carries a valid UUID (OTP login has no admin_users row)
    if (admin?.id && /^[0-9a-f-]{36}$/i.test(admin.id)) {
      payload.created_by = admin.id;
    }
    const { data, error } = await sb.from('job_postings').insert(payload).select('id').single();
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 201, { success: true, message: 'Job created.', id: data.id }, req);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);
    const b = req.body || {};
    const updates = {};
    if (b.title)            updates.title            = b.title.trim().slice(0,220);
    if (b.department  !== undefined) updates.department  = b.department.trim().slice(0,120)||null;
    if (b.location)         updates.location         = b.location.trim().slice(0,160);
    if (VALID_TYPES.includes(b.job_type)) updates.job_type = b.job_type;
    if (b.experience  !== undefined) updates.experience  = b.experience.trim().slice(0,100)||null;
    if (b.salary      !== undefined) updates.salary      = b.salary.trim().slice(0,120)||null;
    if (b.description !== undefined) updates.description = b.description.trim()||null;
    if (b.requirements !== undefined) updates.requirements = b.requirements.trim()||null;
    if (b.responsibilities !== undefined) updates.responsibilities = b.responsibilities.trim()||null;
    if (b.skills      !== undefined) updates.skills      = b.skills.trim().slice(0,300)||null;
    if (b.apply_url   !== undefined) updates.apply_url   = b.apply_url.trim().slice(0,300)||null;
    if (VALID_STATUS.includes(b.status)) {
      updates.status = b.status;
      if (b.status === 'active') {
        // Set posted_at only if not already set
        const { data: cur } = await sb.from('job_postings').select('posted_at').eq('id',id).single();
        if (!cur?.posted_at) updates.posted_at = new Date().toISOString();
      }
    }
    if (b.expires_at !== undefined) updates.expires_at = b.expires_at || null;

    const { error } = await sb.from('job_postings').update(updates).eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Job updated.' }, req);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);
    const { error } = await sb.from('job_postings').delete().eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Job deleted.' }, req);
  }

  return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
}
