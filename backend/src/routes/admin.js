import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getAdminCredentials,
  hashPassword,
  verifyPassword,
  setAdminCredentials,
  setAdminSessionToken,
  generateSessionToken,
} from '../db/index.js';
import { getCookie } from '../middleware/requireAdmin.js';
import { timingSafeEqual } from 'crypto';

const router = Router();

const COOKIE_NAME = 'watchwithme_admin';
const IS_PROD = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again later' },
});

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function isLoggedIn(req) {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) return false;
  const config = getAdminCredentials();
  if (!config?.admin_session_token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(config.admin_session_token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// GET /api/admin/status
router.get('/status', (req, res) => {
  const config = getAdminCredentials();
  res.json({
    loggedIn: isLoggedIn(req),
    hasPassword: !!(config?.admin_password_hash),
  });
});

// POST /api/admin/setup - Create admin credentials (only when none exist)
router.post('/setup', loginLimiter, async (req, res) => {
  const config = getAdminCredentials();
  if (config?.admin_password_hash) {
    return res.status(403).json({ error: 'Admin credentials already set' });
  }

  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 1) {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hash = await hashPassword(password);
    setAdminCredentials(username.trim(), hash);

    const token = generateSessionToken();
    setAdminSessionToken(token);
    setAuthCookie(res, token);

    res.json({ message: 'Admin account created' });
  } catch (err) {
    console.error('Admin setup failed:', err);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
  const config = getAdminCredentials();
  if (!config?.admin_password_hash) {
    return res.status(400).json({ error: 'No admin account configured' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const usernameMatch = config.admin_username === username.trim();
    const passwordMatch = await verifyPassword(password, config.admin_password_hash);

    if (!usernameMatch || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateSessionToken();
    setAdminSessionToken(token);
    setAuthCookie(res, token);

    res.json({ message: 'Logged in' });
  } catch (err) {
    console.error('Admin login failed:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  setAdminSessionToken(null);
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

export default router;
