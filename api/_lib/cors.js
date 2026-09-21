// CORS + preflight helper for Vercel Functions
const ALLOWED_LIST = (process.env.ALLOWED_ORIGIN || 'https://www.uxonicdigital.com')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function resolveOrigin(req) {
  const origin = String(req?.headers?.origin || req?.headers?.Origin || '').trim();

  // Local dev — always echo back the requesting origin
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }

  if (origin && (ALLOWED_LIST.includes('*') || ALLOWED_LIST.includes(origin))) {
    return origin;
  }

  // Same-origin / no Origin header (curl, same-host fetch): allow all
  if (!origin) return '*';

  return ALLOWED_LIST[0] || '*';
}

export function setCors(res, req) {
  const allow = resolveOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Token');
  res.setHeader('Vary', 'Origin');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res, req);
    res.status(204).end();
    return true;
  }
  return false;
}

export function json(res, status, data, req) {
  setCors(res, req);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}
