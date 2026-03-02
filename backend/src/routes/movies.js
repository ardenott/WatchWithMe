import { Router } from 'express';
import {
  getMovies,
  getMovieByKey,
  getMoviesLastCached,
  getDistinctGenres,
  getDistinctContentRatings,
  upsertMovies,
  getPlexConfig,
} from '../db/index.js';
import { fetchAllMovies } from '../services/plex.js';

const router = Router();

// GET /api/movies - Get movies with optional filters
router.get('/', (req, res) => {
  const config = getPlexConfig();
  if (!config?.auth_token) {
    return res.status(401).json({ error: 'Plex not configured' });
  }

  const filters = {
    genres: req.query.genres ? req.query.genres.split(',') : null,
    decades: req.query.decades ? req.query.decades.split(',') : null,
    minRating: req.query.minRating ? parseFloat(req.query.minRating) : null,
    contentRatings: req.query.contentRatings ? req.query.contentRatings.split(',') : null,
    excludeWatched: req.query.excludeWatched === 'true',
  };

  const movies = getMovies(filters);
  res.json({ movies, total: movies.length });
});

// GET /api/movies/count - Get count of cached movies
router.get('/count', (req, res) => {
  const movies = getMovies();
  const lastCached = getMoviesLastCached();
  res.json({ count: movies.length, lastCached });
});

// GET /api/movies/genres - Get distinct genres
router.get('/genres', (req, res) => {
  const genres = getDistinctGenres();
  res.json({ genres });
});

// GET /api/movies/content-ratings - Get distinct content ratings
router.get('/content-ratings', (req, res) => {
  const ratings = getDistinctContentRatings();
  res.json({ ratings });
});

// GET /api/movies/:key - Get a single movie
router.get('/:key', (req, res) => {
  const movie = getMovieByKey(req.params.key);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json({ movie });
});

// POST /api/movies/sync - Re-sync the Plex library
router.post('/sync', async (req, res) => {
  const config = getPlexConfig();
  if (!config?.auth_token || !config?.server_url || !config?.library_section_id) {
    return res.status(400).json({ error: 'Plex not fully configured' });
  }

  res.json({ message: 'Sync started' });

  // Run sync asynchronously
  try {
    const movies = await fetchAllMovies(config.server_url, config.auth_token, config.library_section_id);
    upsertMovies(movies);
    console.log(`Re-synced ${movies.length} movies`);
  } catch (err) {
    console.error('Sync failed:', err.message);
  }
});

export default router;
