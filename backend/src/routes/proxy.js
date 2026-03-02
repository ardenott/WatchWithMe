import { Router } from 'express';
import { getPlexConfig } from '../db/index.js';
import { proxyImage } from '../services/plex.js';

const router = Router();

// GET /api/proxy/image?path=...&w=...&h=...
router.get('/image', async (req, res) => {
  const { path: imagePath, w = 300, h = 450 } = req.query;

  if (!imagePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const config = getPlexConfig();
  if (!config?.auth_token || !config?.server_url) {
    return res.status(401).json({ error: 'Plex not configured' });
  }

  try {
    const { stream, contentType } = await proxyImage(
      config.server_url,
      config.auth_token,
      imagePath,
      parseInt(w),
      parseInt(h)
    );

    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

export default router;
