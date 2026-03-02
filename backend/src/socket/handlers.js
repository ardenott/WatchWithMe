import {
  getSession,
  getSessionUser,
  getSessionUsers,
  updateSessionUser,
} from '../db/index.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Join a session room
    socket.on('session:join', ({ sessionCode, userToken }) => {
      const session = getSession(sessionCode);
      if (!session) return;

      const user = getSessionUser(userToken);
      if (!user || user.session_id !== session.id) return;

      // Update the user's socket ID
      updateSessionUser(userToken, { socket_id: socket.id });

      socket.join(`session:${sessionCode}`);

      // Notify others of user list update
      const users = getSessionUsers(session.id);
      io.to(`session:${sessionCode}`).emit('session:users', {
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          isAdmin: u.is_admin === 1,
          joinedAt: u.joined_at,
        })),
      });
    });

    socket.on('disconnect', () => {
      // We don't remove the user from session on disconnect
      // so their swipes are preserved and they can rejoin
    });
  });
}
