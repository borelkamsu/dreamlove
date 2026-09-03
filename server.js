require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { initSockets } = require('./sockets/index');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const discoverRoutes = require('./routes/discover.routes');
const usersRoutes = require('./routes/users.routes');
const likesRoutes = require('./routes/likes.routes');
const matchesRoutes = require('./routes/matches.routes');
const messagesRoutes = require('./routes/messages.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/conversations', messagesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public/app.html'));
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public/index.html'));
});

app.set('io', io);
initSockets(io, sessionMiddleware);

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Dream Love demarre sur http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Erreur au demarrage du serveur:', err);
  process.exit(1);
});
