import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID, scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'watchwithme.db');
let db;

export function getDb() {
  return db;
}

export function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS plex_config (
      id INTEGER PRIMARY KEY,
      client_id TEXT NOT NULL,
      auth_token TEXT,
      server_url TEXT,
      machine_identifier TEXT,
      server_name TEXT,
      library_section_id TEXT,
      admin_username TEXT,
      admin_password_hash TEXT,
      admin_session_token TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS movies_cache (
      id INTEGER PRIMARY KEY,
      plex_rating_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      summary TEXT,
      tagline TEXT,
      rating REAL,
      audience_rating REAL,
      content_rating TEXT,
      duration INTEGER,
      studio TEXT,
      thumb TEXT,
      art TEXT,
      genres TEXT DEFAULT '[]',
      directors TEXT DEFAULT '[]',
      writers TEXT DEFAULT '[]',
      actors TEXT DEFAULT '[]',
      countries TEXT DEFAULT '[]',
      view_count INTEGER DEFAULT 0,
      cached_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      status TEXT DEFAULT 'waiting',
      movie_order TEXT DEFAULT '[]',
      filter_config TEXT DEFAULT '{}',
      match_percentage REAL DEFAULT 1.0,
      matched_movie_key TEXT,
      matched_at INTEGER,
      total_movies INTEGER DEFAULT 0,
      last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS session_users (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL,
      user_token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      socket_id TEXT,
      joined_at INTEGER DEFAULT (strftime('%s', 'now')),
      is_admin INTEGER DEFAULT 0,
      current_index INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS swipes (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      movie_plex_key TEXT NOT NULL,
      liked INTEGER NOT NULL,
      swiped_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(session_id, user_id, movie_plex_key),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (user_id) REFERENCES session_users(id)
    );
  `);

  // Migrate existing databases
  for (const col of [
    'ALTER TABLE movies_cache ADD COLUMN view_count INTEGER DEFAULT 0',
    'ALTER TABLE plex_config ADD COLUMN admin_username TEXT',
    'ALTER TABLE plex_config ADD COLUMN admin_password_hash TEXT',
    'ALTER TABLE plex_config ADD COLUMN admin_session_token TEXT',
    `ALTER TABLE sessions ADD COLUMN last_activity_at INTEGER DEFAULT (strftime('%s', 'now'))`,
  ]) {
    try { db.exec(col); } catch {}
  }

  const existing = db.prepare('SELECT id FROM plex_config WHERE id = 1').get();
  if (!existing) {
    const clientId = randomUUID();
    db.prepare('INSERT INTO plex_config (id, client_id) VALUES (1, ?)').run(clientId);
  }

  console.log(`Database initialized at ${DB_PATH}`);
  return db;
}

// --- Plex Config ---
export function getPlexConfig() {
  return db.prepare('SELECT * FROM plex_config WHERE id = 1').get();
}

export function updatePlexConfig(fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = Object.values(fields);
  db.prepare(`UPDATE plex_config SET ${sets}, updated_at = strftime('%s', 'now') WHERE id = 1`).run(...values);
}

// --- Admin Auth ---
export function getAdminCredentials() {
  return db.prepare('SELECT admin_username, admin_password_hash, admin_session_token FROM plex_config WHERE id = 1').get();
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = await scryptAsync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

export function setAdminCredentials(username, passwordHash) {
  db.prepare('UPDATE plex_config SET admin_username = ?, admin_password_hash = ? WHERE id = 1').run(username, passwordHash);
}

export function setAdminSessionToken(token) {
  db.prepare('UPDATE plex_config SET admin_session_token = ? WHERE id = 1').run(token);
}

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

// --- Movies Cache ---
export function upsertMovies(movies) {
  const stmt = db.prepare(`
    INSERT INTO movies_cache (
      plex_rating_key, title, year, summary, tagline, rating, audience_rating,
      content_rating, duration, studio, thumb, art, genres, directors,
      writers, actors, countries, view_count, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(plex_rating_key) DO UPDATE SET
      title = excluded.title, year = excluded.year, summary = excluded.summary,
      tagline = excluded.tagline, rating = excluded.rating,
      audience_rating = excluded.audience_rating,
      content_rating = excluded.content_rating, duration = excluded.duration,
      studio = excluded.studio, thumb = excluded.thumb, art = excluded.art,
      genres = excluded.genres, directors = excluded.directors,
      writers = excluded.writers, actors = excluded.actors,
      countries = excluded.countries, view_count = excluded.view_count,
      cached_at = strftime('%s', 'now')
  `);
  const insertMany = db.transaction((movies) => {
    for (const m of movies) {
      stmt.run(
        m.plex_rating_key, m.title, m.year, m.summary, m.tagline,
        m.rating, m.audience_rating, m.content_rating, m.duration, m.studio,
        m.thumb, m.art, m.genres, m.directors, m.writers, m.actors, m.countries,
        m.view_count ?? 0
      );
    }
  });
  insertMany(movies);
}

export function getMovies(filters = {}) {
  let query = 'SELECT * FROM movies_cache WHERE 1=1';
  const params = [];

  if (filters.genres && filters.genres.length > 0) {
    const genreConditions = filters.genres.map(() => `genres LIKE ?`).join(' OR ');
    query += ` AND (${genreConditions})`;
    filters.genres.forEach(g => params.push(`%"${g}"%`));
  }
  if (filters.decades && filters.decades.length > 0) {
    const clauses = [];
    for (const d of filters.decades) {
      const startYear = parseInt(d);
      if (startYear === 1940) {
        clauses.push('year < 1950');
      } else {
        clauses.push('(year >= ? AND year < ?)');
        params.push(startYear, startYear + 10);
      }
    }
    query += ` AND (${clauses.join(' OR ')})`;
  }
  if (filters.excludeWatched) {
    query += ` AND (view_count = 0 OR view_count IS NULL)`;
  }
  if (filters.minRating) {
    query += ` AND rating >= ?`;
    params.push(parseFloat(filters.minRating));
  }
  if (filters.contentRatings && filters.contentRatings.length > 0) {
    query += ` AND content_rating IN (${filters.contentRatings.map(() => '?').join(',')})`;
    params.push(...filters.contentRatings);
  }

  return db.prepare(query).all(...params);
}

export function getMovieByKey(key) {
  return db.prepare('SELECT * FROM movies_cache WHERE plex_rating_key = ?').get(key);
}

export function getMoviesLastCached() {
  const row = db.prepare('SELECT MAX(cached_at) as last FROM movies_cache').get();
  return row?.last || 0;
}

export function getDistinctGenres() {
  const movies = db.prepare('SELECT genres FROM movies_cache').all();
  const genreSet = new Set();
  for (const m of movies) {
    try {
      JSON.parse(m.genres).forEach(g => genreSet.add(g));
    } catch {}
  }
  return [...genreSet].sort();
}

export function getDistinctContentRatings() {
  const rows = db.prepare('SELECT DISTINCT content_rating FROM movies_cache WHERE content_rating IS NOT NULL').all();
  return rows.map(r => r.content_rating).filter(Boolean).sort();
}

// --- Sessions ---
export function createSession(code, filterConfig, matchPercentage) {
  const result = db.prepare(`
    INSERT INTO sessions (code, filter_config, match_percentage)
    VALUES (?, ?, ?)
  `).run(code, JSON.stringify(filterConfig), matchPercentage);
  return result.lastInsertRowid;
}

export function getSession(code) {
  return db.prepare('SELECT * FROM sessions WHERE code = ?').get(code);
}

export function getSessions() {
  return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 100').all();
}

export function updateSession(code, fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = Object.values(fields);
  db.prepare(`UPDATE sessions SET ${sets} WHERE code = ?`).run(...values, code);
}

export function touchSession(code) {
  db.prepare(`UPDATE sessions SET last_activity_at = strftime('%s', 'now') WHERE code = ?`).run(code);
}

export function getExpiredSessions(timeoutSeconds) {
  const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
  return db.prepare(`
    SELECT code FROM sessions
    WHERE status IN ('waiting', 'active')
    AND (last_activity_at IS NULL OR last_activity_at < ?)
  `).all(cutoff);
}

// --- Session Users ---
export function createSessionUser(sessionId, name, userToken, isAdmin = 0) {
  const result = db.prepare(`
    INSERT INTO session_users (session_id, name, user_token, is_admin)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, name, userToken, isAdmin ? 1 : 0);
  return result.lastInsertRowid;
}

export function getSessionUser(userToken) {
  return db.prepare('SELECT * FROM session_users WHERE user_token = ?').get(userToken);
}

export function getSessionUsers(sessionId) {
  return db.prepare('SELECT * FROM session_users WHERE session_id = ?').all(sessionId);
}

export function updateSessionUser(userToken, fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = Object.values(fields);
  db.prepare(`UPDATE session_users SET ${sets} WHERE user_token = ?`).run(...values, userToken);
}

// --- Swipes ---
export function recordSwipe(sessionId, userId, movieKey, liked) {
  try {
    db.prepare(`
      INSERT INTO swipes (session_id, user_id, movie_plex_key, liked)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, user_id, movie_plex_key) DO UPDATE SET liked = excluded.liked
    `).run(sessionId, userId, movieKey, liked ? 1 : 0);
    return true;
  } catch {
    return false;
  }
}

export function checkForMatch(sessionId, matchPercentage) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session || session.status !== 'active') return null;

  const movieOrder = JSON.parse(session.movie_order);
  const users = db.prepare('SELECT * FROM session_users WHERE session_id = ?').all(sessionId);
  const totalUsers = users.length;
  if (totalUsers === 0) return null;

  const required = Math.max(1, Math.ceil(totalUsers * matchPercentage));

  for (const movieKey of movieOrder) {
    const likes = db.prepare(`
      SELECT COUNT(*) as count FROM swipes
      WHERE session_id = ? AND movie_plex_key = ? AND liked = 1
    `).get(sessionId, movieKey);

    if (likes.count >= required) {
      return movieKey;
    }
  }
  return null;
}

export function getSessionStats(sessionId) {
  const swipedCount = db.prepare(`
    SELECT COUNT(DISTINCT movie_plex_key) as count FROM swipes WHERE session_id = ?
  `).get(sessionId);
  return { swipedMovies: swipedCount.count };
}
