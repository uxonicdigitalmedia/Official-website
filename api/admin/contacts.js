// GET/PUT/DELETE /api/admin/contacts
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireAuth(req, res)) return;

  const sb = getSupabase();

  if (req.method === 'GET') {
    const { id, read, search, page = 1, per_page = 25 } = req.query;

    if (id) {
      const { data, error } = await sb.from('contact_submissions').select('*').eq('id', id).single();
      if (error) return json(res, 404, { success: false, message: 'Not found.' }, req);
      if (!data.is_read) {
        await sb.from('contact_submissions').update({ is_read: true }).eq('id', id);
        data.is_read = true;
      }
      return json(res, 200, { success: true, contact: data }, req);
    }

    let query = sb.from('contact_submissions').select('*', { count: 'exact' });
    if (read === '0') query = query.eq('is_read', false);
    if (read === '1') query = query.eq('is_read', true);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`);

    const from = (parseInt(page)-1) * parseInt(per_page);
    const { data, count, error } = await query
      .order('submitted_at', { ascending: false })
      .range(from, from + parseInt(per_page) - 1);

    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, contacts: data, total: count }, req);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const { is_read, admin_notes, mark_all_read } = req.body || {};

    if (mark_all_read) {
      await sb.from('contact_submissions').update({ is_read: true }).eq('is_read', false);
      return json(res, 200, { success: true, message: 'All marked as read.' }, req);
    }

    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);
    const updates = {};
    if (is_read !== undefined)    updates.is_read     = Boolean(is_read);
    if (admin_notes !== undefined) updates.admin_notes = admin_notes.toString().slice(0,2000);
    const { error } = await sb.from('contact_submissions').update(updates).eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Updated.' }, req);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return json(res, 400, { success: false, message: 'id required.' }, req);
    const { error } = await sb.from('contact_submissions').delete().eq('id', id);
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Deleted.' }, req);
  }

  return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
}
