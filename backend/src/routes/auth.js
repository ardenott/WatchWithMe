import { Router } from 'express';
import {
  requestPin,
  buildAuthUrl,
  checkPin,
  getServers,
  findBestServerUrl,
  getLibraries,
} from '../services/plex.js';
import {
  getPlexConfig,
  updatePlexConfig,
  upsertMovies,
} from '../db/index.js';
import { fetchAllMovies as fetchMovies } from '../services/plex.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// GET /api/auth/status - Check if Plex is configured (public)
router.get('/status', (req, res) => {
  const config = getPlexConfig();
  res.json({
    configured: !!(config?.auth_token && config?.server_url),
    serverName: config?.server_name || null,
    hasCachedMovies: false, // updated by /api/movies/count
  });
});

// POST /api/auth/pin - Request a Plex PIN for OAuth
router.post('/pin', requireAdmin, async (req, res) => {
  try {
    const config = getPlexConfig();
    const pin = await requestPin(config.client_id);
    const forwardUrl = req.body.forwardUrl || `${req.protocol}://${req.get('host')}/setup?plexCallback=1`;
    const authUrl = buildAuthUrl(config.client_id, pin.code, forwardUrl);
    res.json({ pinId: pin.id, pinCode: pin.code, authUrl });
  } catch (err) {
    console.error('Pin request failed:', err.message);
    res.status(500).json({ error: 'Failed to request Plex PIN' });
  }
});

// GET /api/auth/pin/:pinId - Poll for PIN authentication
router.get('/pin/:pinId', requireAdmin, async (req, res) => {
  try {
    const config = getPlexConfig();
    const pinData = await checkPin(config.client_id, req.params.pinId);

    if (!pinData.authToken) {
      return res.json({ authenticated: false });
    }

    // PIN authenticated - get available servers
    const servers = await getServers(config.client_id, pinData.authToken);
    updatePlexConfig({ auth_token: pinData.authToken });

    res.json({
      authenticated: true,
      servers: servers.map(s => ({
        name: s.name,
        machineIdentifier: s.clientIdentifier,
        connections: s.connections,
      })),
    });
  } catch (err) {
    console.error('Pin check failed:', err.message);
    res.status(500).json({ error: 'Failed to check PIN status' });
  }
});

// POST /api/auth/server - Save the selected Plex server and sync library
router.post('/server', requireAdmin, async (req, res) => {
  const { machineIdentifier, connections, serverName } = req.body;
  if (!machineIdentifier || !connections) {
    return res.status(400).json({ error: 'Missing server info' });
  }

  try {
    const config = getPlexConfig();
    if (!config.auth_token) {
      return res.status(401).json({ error: 'Not authenticated with Plex' });
    }

    // Find the best connection
    const fakeServer = { connections };
    const serverUrl = await findBestServerUrl(fakeServer, config.auth_token);
    if (!serverUrl) {
      return res.status(400).json({ error: 'Could not connect to Plex server' });
    }

    updatePlexConfig({
      server_url: serverUrl,
      machine_identifier: machineIdentifier,
      server_name: serverName,
    });

    // Get movie libraries
    const libraries = await getLibraries(serverUrl, config.auth_token);
    res.json({ serverUrl, serverName, libraries });
  } catch (err) {
    console.error('Server save failed:', err.message);
    res.status(500).json({ error: 'Failed to connect to server' });
  }
});

// POST /api/auth/library - Set the library to use
router.post('/library', requireAdmin, async (req, res) => {
  const { librarySectionId } = req.body;
  if (!librarySectionId) {
    return res.status(400).json({ error: 'Missing library section ID' });
  }

  try {
    const config = getPlexConfig();
    if (!config.auth_token || !config.server_url) {
      return res.status(401).json({ error: 'Not configured' });
    }

    updatePlexConfig({ library_section_id: String(librarySectionId) });

    // Trigger background sync
    syncLibrary(config.server_url, config.auth_token, librarySectionId);

    res.json({ message: 'Library selected, sync started' });
  } catch (err) {
    console.error('Library selection failed:', err.message);
    res.status(500).json({ error: 'Failed to set library' });
  }
});

// POST /api/auth/logout - Clear Plex configuration
router.post('/logout', requireAdmin, (req, res) => {
  updatePlexConfig({
    auth_token: null,
    server_url: null,
    machine_identifier: null,
    server_name: null,
    library_section_id: null,
  });
  res.json({ message: 'Logged out' });
});

async function syncLibrary(serverUrl, authToken, sectionId) {
  try {
    console.log(`Syncing library section ${sectionId}...`);
    const movies = await fetchMovies(serverUrl, authToken, sectionId);
    upsertMovies(movies);
    console.log(`Synced ${movies.length} movies`);
  } catch (err) {
    console.error('Library sync failed:', err.message);
  }
}

export { syncLibrary };
export default router;
