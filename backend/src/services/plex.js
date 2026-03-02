import axios from 'axios';

const PLEX_TV_BASE = 'https://plex.tv/api/v2';
const APP_NAME = 'WatchWithMe';
const APP_VERSION = '1.0.0';
const PLATFORM = 'Web';

function plexHeaders(clientId, token = null) {
  const headers = {
    'X-Plex-Client-Identifier': clientId,
    'X-Plex-Product': APP_NAME,
    'X-Plex-Version': APP_VERSION,
    'X-Plex-Platform': PLATFORM,
    'Accept': 'application/json',
  };
  if (token) headers['X-Plex-Token'] = token;
  return headers;
}

// Request a PIN from plex.tv for OAuth
export async function requestPin(clientId) {
  const res = await axios.post(`${PLEX_TV_BASE}/pins`, null, {
    params: { strong: true },
    headers: plexHeaders(clientId),
  });
  return res.data; // { id, code, authToken (null until authenticated) }
}

// Build the plex.tv auth URL to redirect the user to
export function buildAuthUrl(clientId, pinCode, forwardUrl) {
  const params = new URLSearchParams({
    clientID: clientId,
    code: pinCode,
    forwardUrl: forwardUrl,
    'context[device][product]': APP_NAME,
    'context[device][version]': APP_VERSION,
    'context[device][platform]': PLATFORM,
  });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

// Poll for PIN authentication status
export async function checkPin(clientId, pinId) {
  const res = await axios.get(`${PLEX_TV_BASE}/pins/${pinId}`, {
    headers: plexHeaders(clientId),
  });
  return res.data; // { authToken: null | 'token...' }
}

// Get the user's Plex servers
export async function getServers(clientId, authToken) {
  const res = await axios.get(`${PLEX_TV_BASE}/resources`, {
    params: { includeHttps: 1, includeRelay: 1, includeIPv6: 1 },
    headers: plexHeaders(clientId, authToken),
  });
  const resources = res.data;
  return resources.filter(r => r.provides === 'server');
}

// Find the best reachable connection URL for a server
export async function findBestServerUrl(server, authToken) {
  const connections = server.connections || [];

  // Prefer local connections over relay
  const sorted = [...connections].sort((a, b) => {
    if (a.relay && !b.relay) return 1;
    if (!a.relay && b.relay) return -1;
    if (a.local && !b.local) return -1;
    if (!a.local && b.local) return 1;
    return 0;
  });

  for (const conn of sorted) {
    try {
      await axios.get(`${conn.uri}/identity`, {
        headers: { 'X-Plex-Token': authToken },
        timeout: 3000,
      });
      return conn.uri;
    } catch {
      // Try next connection
    }
  }
  return null;
}

// Get movie libraries from the Plex server
export async function getLibraries(serverUrl, authToken) {
  const res = await axios.get(`${serverUrl}/library/sections`, {
    headers: { 'X-Plex-Token': authToken, 'Accept': 'application/json' },
    timeout: 10000,
  });
  const sections = res.data?.MediaContainer?.Directory || [];
  return sections.filter(s => s.type === 'movie');
}

// Fetch all movies from a library section, with pagination
export async function fetchAllMovies(serverUrl, authToken, sectionId) {
  const PAGE_SIZE = 200;
  let offset = 0;
  let allMovies = [];

  while (true) {
    const res = await axios.get(`${serverUrl}/library/sections/${sectionId}/all`, {
      headers: { 'X-Plex-Token': authToken, 'Accept': 'application/json' },
      params: {
        type: 1, // movie type
        'X-Plex-Container-Start': offset,
        'X-Plex-Container-Size': PAGE_SIZE,
      },
      timeout: 30000,
    });

    const container = res.data?.MediaContainer;
    const movies = container?.Metadata || [];
    allMovies = allMovies.concat(movies);

    if (movies.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allMovies.map(normalizePlexMovie);
}

function normalizePlexMovie(m) {
  const genres = (m.Genre || []).map(g => g.tag);
  const directors = (m.Director || []).map(d => d.tag);
  const writers = (m.Writer || []).map(w => w.tag);
  const actors = (m.Role || []).slice(0, 10).map(r => ({ name: r.tag, role: r.role, thumb: r.thumb }));
  const countries = (m.Country || []).map(c => c.tag);

  return {
    plex_rating_key: String(m.ratingKey),
    title: m.title || 'Unknown',
    year: m.year || null,
    summary: m.summary || null,
    tagline: m.tagline || null,
    rating: m.rating ? parseFloat(m.rating) : null,
    audience_rating: m.audienceRating ? parseFloat(m.audienceRating) : null,
    content_rating: m.contentRating || null,
    duration: m.duration ? Math.round(m.duration / 60000) : null, // store in minutes
    studio: m.studio || null,
    thumb: m.thumb || null,
    art: m.art || null,
    view_count: m.viewCount ? parseInt(m.viewCount) : 0,
    genres: JSON.stringify(genres),
    directors: JSON.stringify(directors),
    writers: JSON.stringify(writers),
    actors: JSON.stringify(actors),
    countries: JSON.stringify(countries),
  };
}

// Get a specific movie's full details
export async function getMovieDetails(serverUrl, authToken, ratingKey) {
  const res = await axios.get(`${serverUrl}/library/metadata/${ratingKey}`, {
    headers: { 'X-Plex-Token': authToken, 'Accept': 'application/json' },
    timeout: 10000,
  });
  const m = res.data?.MediaContainer?.Metadata?.[0];
  if (!m) return null;
  return normalizePlexMovie(m);
}

// Proxy an image from Plex
export async function proxyImage(serverUrl, authToken, imagePath, width = 300, height = 450) {
  const url = `${serverUrl}/photo/:/transcode`;
  const res = await axios.get(url, {
    params: {
      url: imagePath,
      width,
      height,
      'X-Plex-Token': authToken,
      minSize: 1,
    },
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  return { buffer: Buffer.from(res.data), contentType: res.headers['content-type'] };
}
