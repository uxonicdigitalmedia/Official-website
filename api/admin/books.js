// POST /api/admin/books — Admin → UXONIC Books.
// The website admin (OTP login) is the only way in. This function calls the
// UXONIC Books database's platform_* functions with a private server key
// (BOOKS_PLATFORM_KEY, sent as the x-platform-key header). The database keeps
// only that key's SHA-256 and refuses every call without it. The key never
// reaches the browser.
import { handleOptions, json } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';

// Only these functions can be reached through the admin panel.
const ALLOWED = new Set([
  'platform_overview', 'platform_orgs', 'platform_org', 'platform_update_subscription',
  'platform_record_payment', 'platform_set_payment_status', 'platform_set_org_status',
  'platform_payments', 'platform_plans', 'platform_save_plan', 'platform_save_settings',
]);

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed.' }, req);
  if (!requireAuth(req, res)) return;

  const url = process.env.BOOKS_SUPABASE_URL;
  const anonKey = process.env.BOOKS_PUBLISHABLE_KEY;
  const serverKey = process.env.BOOKS_PLATFORM_KEY;
  if (!url || !anonKey || !serverKey) {
    return json(res, 503, { success: false, message: 'UXONIC Books is not connected yet: BOOKS_SUPABASE_URL, BOOKS_PUBLISHABLE_KEY and BOOKS_PLATFORM_KEY are missing on the server.' }, req);
  }

  const { fn, args } = req.body || {};
  if (!ALLOWED.has(fn)) return json(res, 400, { success: false, message: 'Unknown action.' }, req);
  if (args !== undefined && (typeof args !== 'object' || Array.isArray(args) || args === null)) {
    return json(res, 400, { success: false, message: 'Invalid arguments.' }, req);
  }

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', 'x-platform-key': serverKey },
      body: JSON.stringify(args || {}),
    });
    const text = await r.text();
    const body = text ? JSON.parse(text) : null;
    if (!r.ok) {
      // Postgres errors come back as { code, message, hint }; message is a short code like "invalid_input".
      const missing = body?.code === 'PGRST202' || /Could not find the function/.test(body?.message || '');
      return json(res, missing ? 501 : r.status === 401 || r.status === 403 ? 403 : 400, {
        success: false,
        code: body?.message || 'error',
        hint: body?.hint || null,
        message: missing ? 'The UXONIC Books database is not updated yet. Run: npx supabase db push' : body?.message || 'Request failed.',
      }, req);
    }
    return json(res, 200, { success: true, data: body }, req);
  } catch (err) {
    console.error('admin/books exception:', err);
    return json(res, 502, { success: false, message: 'Could not reach UXONIC Books. Please try again.' }, req);
  }
}
