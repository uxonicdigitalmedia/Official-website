// Admin JWT auth helper for Vercel Functions
import jwt from 'jsonwebtoken';

const SECRET = process.env.ADMIN_JWT_SECRET || 'fallback_dev_secret_change_in_prod';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  try {
    return { valid: true, payload: jwt.verify(token, SECRET) };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

export function requireAuth(req, res) {
  const header = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) {
    // Keep CORS headers on auth failures so browser shows real error
    try {
      const origin = (req.headers.origin || '').trim();
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } catch (_) {}
    res.status(401).json({ success: false, message: 'Unauthorised. No token.' });
    return null;
  }
  const result = verifyToken(token);
  if (!result.valid) {
    try {
      const origin = (req.headers.origin || '').trim();
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } catch (_) {}
    res.status(401).json({ success: false, message: 'Token invalid or expired.' });
    return null;
  }
  return result.payload;
}
