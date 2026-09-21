// GET /api/jobs — public list of active job postings
import { getSupabase } from './_lib/supabase.js';
import { handleOptions, json } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('job_postings')
      .select('id,title,department,location,job_type,experience,salary,description,skills,apply_url,status,posted_at,expires_at')
      .eq('status', 'active')
      .order('posted_at', { ascending: false });

    if (error) return json(res, 500, { success: false, message: error.message }, req);
    return json(res, 200, { success: true, jobs: data || [] }, req);
  } catch (e) {
    return json(res, 500, { success: false, message: e.message }, req);
  }
}
