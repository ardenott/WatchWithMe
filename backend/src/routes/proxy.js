import { Router } from 'express';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlexConfig } from '../db/index.js';
import { proxyImage } from '../services/plex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const IMAGE_CACHE_DIR = path.join(DATA_DIR, 'image-cache');

if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

const router = Router();

// GET /api/proxy/image?path=...&w=...&h=...
router.get('/image', async (req, res) => {
  const { path: imagePath, w = 300, h = 450 } = req.query;

  if (!imagePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const cacheKey = createHash('sha256').update(`${imagePath}_${w}x${h}`).digest('hex');
  const cachePath = path.join(IMAGE_CACHE_DIR, `${cacheKey}.jpg`);

  // Serve from disk cache if available
  if (fs.existsSync(cachePath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.sendFile(cachePath);
  }

  const config = getPlexConfig();
  if (!config?.auth_token || !config?.server_url) {
    return res.status(401).json({ error: 'Plex not configured' });
  }

  try {
    const { buffer, contentType } = await proxyImage(
      config.server_url,
      config.auth_token,
      imagePath,
      parseInt(w),
      parseInt(h)
    );

    // Write to disk cache (non-blocking)
    fs.writeFile(cachePath, buffer, (err) => {
      if (err) console.error('Image cache write error:', err.message);
    });

    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(buffer);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

export default router;
