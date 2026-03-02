import { timingSafeEqual } from 'crypto';
import { getAdminCredentials } from '../db/index.js';

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  for (const c of cookies) {
    const [k, v] = c.trim().split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return null;
}

export function requireAdmin(req, res, next) {
  const token = getCookie(req, 'watchwithme_admin');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const config = getAdminCredentials();
  if (!config?.admin_session_token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(config.admin_session_token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

export { getCookie };
