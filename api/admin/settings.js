// GET/PUT /api/admin/settings — site settings management
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  let sb;
  try {
    sb = getSupabase();
  } catch (e) {
    return json(res, 500, { success: false, message: e.message }, req);
  }

  // GET — public (no auth needed for reading settings)
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('site_settings')
      .select('key, value, label')
      .order('key');
    if (error) return json(res, 500, { success: false, message: error.message }, req);
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return json(res, 200, { success: true, settings, rows: data }, req);
  }

  // PUT — requires admin auth
  // Accepts: { key, value } OR { settings: { key: value, ... } } for bulk
  if (req.method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const body = req.body || {};

    const updates = [];
    if (body.settings && typeof body.settings === 'object') {
      Object.entries(body.settings).forEach(([key, value]) => {
        if (key) updates.push({ key, value: String(value ?? ''), updated_at: new Date().toISOString() });
      });
    } else if (body.key) {
      updates.push({ key: body.key, value: String(body.value ?? ''), updated_at: new Date().toISOString() });
    } else {
      return json(res, 400, { success: false, message: 'key or settings object required.' }, req);
    }

    const { error } = await sb
      .from('site_settings')
      .upsert(updates, { onConflict: 'key' });

    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, message: 'Settings updated.', count: updates.length }, req);
  }

  return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
}
