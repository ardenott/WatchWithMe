import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/index.js';
import { setIo } from './socket/index.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { startSessionCleanup } from './services/sessionCleanup.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import moviesRouter from './routes/movies.js';
import proxyRouter from './routes/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000');
const IS_DEV = process.env.NODE_ENV !== 'production';

// Initialize database
initDatabase();
startSessionCleanup();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: IS_DEV ? {
    origin: ['http://localhost:5173'],
    credentials: true,
  } : false,
});

setIo(io);
setupSocketHandlers(io);

// Trust proxy (required for secure cookies + correct IPs behind nginx/Caddy)
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Middleware
if (IS_DEV) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}
app.use(express.json());

// API Routes
app.use('/api/admin', adminRouter);
app.use('/api/auth', requireAdmin, authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/movies', requireAdmin, moviesRouter);
app.use('/api/proxy', proxyRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Serve frontend in production
if (!IS_DEV) {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`WatchWithMe running on http://0.0.0.0:${PORT} [${IS_DEV ? 'development' : 'production'}]`);
});
