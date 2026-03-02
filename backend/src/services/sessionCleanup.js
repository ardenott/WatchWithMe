import { getExpiredSessions, updateSession } from '../db/index.js';
import { getIo } from '../socket/index.js';

const TIMEOUT_SECONDS = 5 * 60; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

export function startSessionCleanup() {
  setInterval(() => {
    const expired = getExpiredSessions(TIMEOUT_SECONDS);
    if (expired.length === 0) return;

    const io = getIo();
    for (const { code } of expired) {
      updateSession(code, { status: 'ended' });
      console.log(`Session ${code} ended due to inactivity`);
      if (io) {
        io.to(`session:${code}`).emit('session:ended', {});
      }
    }
  }, CHECK_INTERVAL_MS);
}
