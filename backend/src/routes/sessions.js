import { Router } from 'express';
import { randomUUID } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createSession,
  getSession,
  getSessions,
  updateSession,
  touchSession,
  createSessionUser,
  getSessionUser,
  getSessionUsers,
  recordSwipe,
  checkForMatch,
  getMovies,
  getMovieByKey,
  getPlexConfig,
  getSessionStats,
} from '../db/index.js';
import { getIo } from '../socket/index.js';

const router = Router();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
});

// POST /api/sessions - Create a new session (admin only)
router.post('/', requireAdmin, (req, res) => {
  const config = getPlexConfig();
  if (!config?.auth_token) {
    return res.status(401).json({ error: 'Plex not configured' });
  }

  const {
    filterConfig = {},
    matchPercentage = 1.0,
    adminName = 'Host',
  } = req.body;

  // Generate unique code
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 100) return res.status(500).json({ error: 'Could not generate unique code' });
  } while (getSession(code));

  // Get filtered movies and shuffle
  const movies = getMovies(filterConfig);
  if (movies.length === 0) {
    return res.status(400).json({ error: 'No movies match the selected filters' });
  }

  const movieOrder = shuffleArray(movies.map(m => m.plex_rating_key));

  const sessionId = createSession(code, filterConfig, matchPercentage);
  updateSession(code, {
    movie_order: JSON.stringify(movieOrder),
    total_movies: movieOrder.length,
    status: 'active',
  });
  touchSession(code);

  // Create admin user
  const userToken = randomUUID();
  const userId = createSessionUser(sessionId, adminName, userToken, true);

  res.json({
    code,
    userToken,
    userId,
    totalMovies: movieOrder.length,
    shareUrl: `${req.protocol}://${req.get('host')}/join/${code}`,
  });
});

// GET /api/sessions - Get session history
router.get('/', requireAdmin, (req, res) => {
  const sessions = getSessions();
  const result = sessions.map(s => {
    const users = getSessionUsers(s.id);
    const matchedMovie = s.matched_movie_key ? getMovieByKey(s.matched_movie_key) : null;
    return {
      ...s,
      filter_config: JSON.parse(s.filter_config || '{}'),
      movie_order: undefined, // Don't send full order in list
      users: users.map(u => ({ name: u.name, isAdmin: u.is_admin === 1 })),
      matchedMovie: matchedMovie ? {
        title: matchedMovie.title,
        year: matchedMovie.year,
        thumb: matchedMovie.thumb,
        plex_rating_key: matchedMovie.plex_rating_key,
      } : null,
    };
  });
  res.json({ sessions: result });
});

// GET /api/sessions/:code - Get session info
router.get('/:code', (req, res) => {
  const session = getSession(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const users = getSessionUsers(session.id);
  const matchedMovie = session.matched_movie_key ? getMovieByKey(session.matched_movie_key) : null;
  const stats = getSessionStats(session.id);

  res.json({
    code: session.code,
    status: session.status,
    createdAt: session.created_at,
    totalMovies: session.total_movies,
    matchPercentage: session.match_percentage,
    filterConfig: JSON.parse(session.filter_config || '{}'),
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      isAdmin: u.is_admin === 1,
      joinedAt: u.joined_at,
    })),
    matchedMovie: matchedMovie ? parseMovie(matchedMovie) : null,
    stats,
  });
});

// POST /api/sessions/:code/join - Join a session
router.post('/:code/join', joinLimiter, (req, res) => {
  const session = getSession(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.status === 'matched') {
    return res.status(400).json({ error: 'This session has already ended with a match' });
  }

  const { name } = req.body;
  if (!name || name.trim().length < 1) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const userToken = randomUUID();
  const userId = createSessionUser(session.id, name.trim().slice(0, 30), userToken, false);
  touchSession(session.code);

  const movieOrder = JSON.parse(session.movie_order);
  const io = getIo();

  // Notify other users in the session
  const users = getSessionUsers(session.id);
  if (io) {
    io.to(`session:${session.code}`).emit('session:users', {
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        isAdmin: u.is_admin === 1,
        joinedAt: u.joined_at,
      })),
    });
  }

  res.json({
    userToken,
    userId,
    sessionCode: session.code,
    sessionStatus: session.status,
    totalMovies: session.total_movies,
    matchedMovie: session.matched_movie_key ? getMovieByKey(session.matched_movie_key) : null,
  });
});

// GET /api/sessions/:code/movies - Get movies for the session (paginated)
router.get('/:code/movies', (req, res) => {
  const { userToken } = req.query;
  if (!userToken) return res.status(401).json({ error: 'Missing userToken' });

  const session = getSession(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const user = getSessionUser(userToken);
  if (!user || user.session_id !== session.id) {
    return res.status(403).json({ error: 'Not in this session' });
  }

  const start = parseInt(req.query.start) || 0;
  const count = Math.min(parseInt(req.query.count) || 20, 50);

  const movieOrder = JSON.parse(session.movie_order);
  const slice = movieOrder.slice(start, start + count);

  const movies = slice.map(key => {
    const m = getMovieByKey(key);
    return m ? parseMovie(m) : null;
  }).filter(Boolean);

  res.json({
    movies,
    start,
    total: movieOrder.length,
    hasMore: start + count < movieOrder.length,
  });
});

// POST /api/sessions/:code/swipe - Record a swipe
router.post('/:code/swipe', (req, res) => {
  const { userToken, movieKey, liked } = req.body;
  if (!userToken || !movieKey || liked === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const session = getSession(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.status !== 'active') {
    return res.json({ recorded: false, match: session.matched_movie_key || null });
  }

  const user = getSessionUser(userToken);
  if (!user || user.session_id !== session.id) {
    return res.status(403).json({ error: 'Not in this session' });
  }

  recordSwipe(session.id, user.id, movieKey, liked);
  touchSession(session.code);

  // Check for match
  const matchKey = checkForMatch(session.id, session.match_percentage);
  if (matchKey) {
    updateSession(session.code, {
      status: 'matched',
      matched_movie_key: matchKey,
      matched_at: Math.floor(Date.now() / 1000),
    });

    const matchedMovie = getMovieByKey(matchKey);
    const io = getIo();
    if (io) {
      io.to(`session:${session.code}`).emit('session:match', {
        movie: matchedMovie ? parseMovie(matchedMovie) : null,
      });
    }

    return res.json({ recorded: true, match: parseMovie(matchedMovie) });
  }

  res.json({ recorded: true, match: null });
});

// DELETE /api/sessions/:code - End a session
router.delete('/:code', (req, res) => {
  const { userToken } = req.body;
  const session = getSession(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const user = getSessionUser(userToken);
  if (!user || user.session_id !== session.id || !user.is_admin) {
    return res.status(403).json({ error: 'Only the session creator can end the session' });
  }

  updateSession(session.code, { status: 'ended' });
  const io = getIo();
  if (io) {
    io.to(`session:${session.code}`).emit('session:ended', {});
  }
  res.json({ message: 'Session ended' });
});

function parseMovie(m) {
  if (!m) return null;
  return {
    ...m,
    genres: tryParse(m.genres, []),
    directors: tryParse(m.directors, []),
    writers: tryParse(m.writers, []),
    actors: tryParse(m.actors, []),
    countries: tryParse(m.countries, []),
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
