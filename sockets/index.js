const User = require('../models/User');

const OFFLINE_GRACE_MS = 8000;
const pendingOffline = new Map();

function initSockets(io, sessionMiddleware) {
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const session = socket.request.session;
    if (!session || !session.userId) {
      return next(new Error('unauthorized'));
    }
    socket.userId = session.userId;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    if (pendingOffline.has(userId)) {
      clearTimeout(pendingOffline.get(userId));
      pendingOffline.delete(userId);
    }

    try {
      const user = await User.findByIdAndUpdate(userId, { online: true }, { new: true });
      if (user) {
        broadcastPresence(io, user._id, true, user.lastSeen);
      }
    } catch (err) {
      console.error('Erreur presence connect:', err);
    }

    socket.on('typing', ({ conversationId, toUserId }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit('typing', { conversationId, fromUserId: userId });
    });

    socket.on('disconnect', () => {
      const timeout = setTimeout(async () => {
        pendingOffline.delete(userId);
        try {
          const stillConnected = io.sockets.adapter.rooms.get(`user:${userId}`);
          if (stillConnected && stillConnected.size > 0) return;
          const now = new Date();
          const user = await User.findByIdAndUpdate(userId, { online: false, lastSeen: now }, { new: true });
          if (user) {
            broadcastPresence(io, user._id, false, now);
          }
        } catch (err) {
          console.error('Erreur presence disconnect:', err);
        }
      }, OFFLINE_GRACE_MS);
      pendingOffline.set(userId, timeout);
    });
  });
}

function broadcastPresence(io, userId, online, lastSeen) {
  io.emit('presence:update', { userId, online, lastSeen });
}

module.exports = { initSockets };
