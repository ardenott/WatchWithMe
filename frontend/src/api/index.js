const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const del = (path, body) => request('DELETE', path, body);

// Admin auth
export const admin = {
  status: () => get('/admin/status'),
  setup: (data) => post('/admin/setup', data),
  login: (data) => post('/admin/login', data),
  logout: () => post('/admin/logout'),
};

// Auth
export const auth = {
  status: () => get('/auth/status'),
  requestPin: (forwardUrl) => post('/auth/pin', { forwardUrl }),
  pollPin: (pinId) => get(`/auth/pin/${pinId}`),
  saveServer: (data) => post('/auth/server', data),
  saveLibrary: (librarySectionId) => post('/auth/library', { librarySectionId }),
  logout: () => post('/auth/logout'),
};

// Movies
export const movies = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.genres?.length) params.set('genres', filters.genres.join(','));
    if (filters.decades?.length) params.set('decades', filters.decades.join(','));
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.contentRatings?.length) params.set('contentRatings', filters.contentRatings.join(','));
    if (filters.excludeWatched) params.set('excludeWatched', 'true');
    const qs = params.toString();
    return get(`/movies${qs ? '?' + qs : ''}`);
  },
  count: () => get('/movies/count'),
  genres: () => get('/movies/genres'),
  contentRatings: () => get('/movies/content-ratings'),
  sync: () => post('/movies/sync'),
  get: (key) => get(`/movies/${key}`),
};

// Sessions
export const sessions = {
  create: (data) => post('/sessions', data),
  list: () => get('/sessions'),
  get: (code) => get(`/sessions/${code}`),
  join: (code, name) => post(`/sessions/${code}/join`, { name }),
  swipe: (code, data) => post(`/sessions/${code}/swipe`, data),
  getMovies: (code, start, count, userToken) =>
    get(`/sessions/${code}/movies?start=${start}&count=${count}&userToken=${userToken}`),
  end: (code, userToken) => del(`/sessions/${code}`, { userToken }),
};
