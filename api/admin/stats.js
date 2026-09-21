// GET /api/admin/stats — dashboard overview counts
import { getSupabase } from '../_lib/supabase.js';
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireAuth(req, res)) return;

  const sb = getSupabase();
  const today = new Date(); today.setHours(0,0,0,0);

  const [
    { count: appTotal },
    { count: appNew },
    { count: appShortlisted },
    { count: appToday },
    { count: jobsActive },
    { count: jobsTotal },
    { count: contactTotal },
    { count: contactUnread },
    { data: byStatus },
  ] = await Promise.all([
    sb.from('internship_applications').select('*', { count: 'exact', head: true }),
    sb.from('internship_applications').select('*', { count: 'exact', head: true }).eq('status','new'),
    sb.from('internship_applications').select('*', { count: 'exact', head: true }).eq('status','shortlisted'),
    sb.from('internship_applications').select('*', { count: 'exact', head: true }).gte('submitted_at', today.toISOString()),
    sb.from('job_postings').select('*', { count: 'exact', head: true }).eq('status','active'),
    sb.from('job_postings').select('*', { count: 'exact', head: true }),
    sb.from('contact_submissions').select('*', { count: 'exact', head: true }),
    sb.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    sb.from('internship_applications').select('status'),
  ]);

  // Status breakdown
  const statusCounts = { new:0, reviewing:0, shortlisted:0, rejected:0, hired:0 };
  (byStatus || []).forEach(r => { if (statusCounts[r.status] !== undefined) statusCounts[r.status]++; });

  return json(res, 200, {
    success: true,
    stats: {
      applications: { total: appTotal||0, new: appNew||0, shortlisted: appShortlisted||0, today: appToday||0, byStatus: statusCounts },
      jobs:         { active: jobsActive||0, total: jobsTotal||0 },
      contacts:     { total: contactTotal||0, unread: contactUnread||0 },
    },
  }, req);
}
