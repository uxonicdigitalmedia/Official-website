// GET/POST/DELETE /api/admin/applications
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireAuth(req, res)) return;

  const sb = getSupabase();
  const { method } = req;

  // ── GET — list or single ──────────────────────────────────────
  if (method === 'GET') {
    const { id, status, search, page = 1, per_page = 20 } = req.query;

    // Single application
    if (id) {
      const { data, error } = await sb
        .from('internship_applications')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return json(res, 404, { success: false, message: 'Not found.' }, req);

      // Auto-mark as reviewing if new
      if (data.status === 'new') {
        await sb.from('internship_applications').update({ status: 'reviewing' }).eq('id', id);
        data.status = 'reviewing';
      }

      // Generate signed resume URL if exists
      let resumeUrl = null;
      if (data.resume_path) {
        const { data: signed } = await sb.storage
          .from('resumes')
          .createSignedUrl(data.resume_path, 300); // 5 min expiry
        resumeUrl = signed?.signedUrl || null;
      }

      return json(res, 200, { success: true, application: { ...data, resumeUrl } }, req);
    }

    // List with filters
    let query = sb.from('internship_applications').select('*', { count: 'exact' });
    if (status && ['new','reviewing','shortlisted','rejected','hired'].includes(status)) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const from = (parseInt(page) - 1) * parseInt(per_page);
    const to   = from + parseInt(per_page) - 1;

    const { data, count, error } = await query
      .order('submitted_at', { ascending: false })
      .range(from, to);

    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, applications: data, total: count, page: parseInt(page), per_page: parseInt(per_page) }, req);
  }

  // ── PUT — update status or notes ─────────────────────────────
  if (method === 'PUT') {
    const { id, status, admin_notes } = req.body || {};
    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);

    const updates = {};
    if (status && ['new','reviewing','shortlisted','rejected','hired'].includes(status)) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes.toString().slice(0, 2000);

    if (!Object.keys(updates).length) return json(res, 400, { success: false, message: 'Nothing to update.' }, req);

    const { error } = await sb.from('internship_applications').update(updates).eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Updated.' }, req);
  }

  // ── DELETE ────────────────────────────────────────────────────
  if (method === 'DELETE') {
    const { id } = req.query;
    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);

    // Get resume path first
    const { data: row } = await sb.from('internship_applications').select('resume_path').eq('id', id).single();
    if (row?.resume_path) {
      await sb.storage.from('resumes').remove([row.resume_path]);
    }

    const { error } = await sb.from('internship_applications').delete().eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Deleted.' }, req);
  }

  return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
}
