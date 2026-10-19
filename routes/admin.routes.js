const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AdminMessage = require('../models/AdminMessage');
const { requireAdmin, requireRole, loadAdmin, clearAdminSession } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Full admins only (editors can just review certifications)
const adminOnly = [requireAdmin, requireRole('admin')];

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    // Main account defined in the .env file: always a full admin
    if (process.env.ADMIN_USER && username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      req.session.isAdmin = true;
      req.session.adminId = null;
      req.session.adminRole = 'admin';
      req.session.adminUsername = username;
      return res.json({ ok: true, role: 'admin', username });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Identifiants administrateur invalides' });
    }
    admin.lastLoginAt = new Date();
    await admin.save();
    req.session.isAdmin = true;
    req.session.adminId = String(admin._id);
    req.session.adminRole = admin.role;
    req.session.adminUsername = admin.username;
    res.json({ ok: true, role: admin.role, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

router.post('/logout', (req, res) => {
  clearAdminSession(req.session);
  res.json({ ok: true });
});

router.get('/session', async (req, res) => {
  try {
    const admin = await loadAdmin(req);
    if (!admin) return res.json({ isAdmin: false });
    res.json({ isAdmin: true, role: admin.role, username: admin.username });
  } catch (err) {
    console.error(err);
    res.json({ isAdmin: false });
  }
});

// ---------- Staff accounts (admins only) ----------

router.get('/team', adminOnly, async (req, res) => {
  const admins = await Admin.find({}).sort({ createdAt: 1 });
  res.json({
    me: req.admin,
    mainAccount: process.env.ADMIN_USER || null,
    admins: admins.map((a) => a.toSafeJSON()),
  });
});

router.post('/team', adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role;
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Identifiant invalide (3 a 30 caracteres : lettres, chiffres, . _ -)' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
    }
    if (!Admin.ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role invalide' });
    }
    const envUser = (process.env.ADMIN_USER || '').toLowerCase();
    if (username === envUser || (await Admin.exists({ username }))) {
      return res.status(409).json({ error: 'Cet identifiant est deja utilise' });
    }
    const admin = await Admin.create({
      username,
      password: await bcrypt.hash(password, 10),
      role,
      createdBy: req.admin.username,
    });
    res.status(201).json({ admin: admin.toSafeJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation du compte' });
  }
});

router.put('/team/:id', adminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Compte introuvable' });
    const { role, password } = req.body;
    if (role !== undefined) {
      if (!Admin.ADMIN_ROLES.includes(role)) return res.status(400).json({ error: 'Role invalide' });
      if (String(admin._id) === req.admin.id && role !== 'admin') {
        return res.status(400).json({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur' });
      }
      admin.role = role;
    }
    if (password !== undefined && password !== '') {
      if (String(password).length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
      }
      admin.password = await bcrypt.hash(String(password), 10);
    }
    await admin.save();
    res.json({ admin: admin.toSafeJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour du compte' });
  }
});

router.delete('/team/:id', adminOnly, async (req, res) => {
  if (req.params.id === req.admin.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const admin = await Admin.findByIdAndDelete(req.params.id).catch(() => null);
  if (!admin) return res.status(404).json({ error: 'Compte introuvable' });
  res.json({ ok: true });
});

router.get('/stats', requireAdmin, async (req, res) => {
  const [totalUsers, verifiedUsers, pendingVerifications, rejectedVerifications, totalMatches, totalMessages, onlineNow] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ verified: true }),
      User.countDocuments({ verificationStatus: 'pending' }),
      User.countDocuments({ verificationStatus: 'rejected' }),
      Conversation.countDocuments({}),
      Message.countDocuments({}),
      User.countDocuments({ online: true }),
    ]);
  res.json({
    totalUsers,
    verifiedUsers,
    pendingVerifications,
    rejectedVerifications,
    totalMatches,
    totalMessages,
    onlineNow,
  });
});

router.get('/users', adminOnly, async (req, res) => {
  const { search = '', status = '', page = 1 } = req.query;
  const limit = 20;
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.verificationStatus = status;

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      gender: u.gender,
      photo: u.photos[u.mainPhotoIndex]?.url || u.photos[0]?.url || null,
      verified: u.verified,
      verificationStatus: u.verificationStatus,
      isBanned: u.isBanned,
      online: u.online,
      lastSeen: u.lastSeen,
      createdAt: u.createdAt,
    })),
  });
});

router.get('/verifications', requireAdmin, async (req, res) => {
  const users = await User.find({ verificationStatus: 'pending' }).sort({ updatedAt: 1 });
  res.json({
    requests: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      docs: u.verificationDocs,
      submittedAt: u.updatedAt,
    })),
  });
});

router.post('/users/:id/verify', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { verified: true, verificationStatus: 'approved', verificationRejectReason: '' },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const io = req.app.get('io');
  if (io) io.to(`user:${user._id}`).emit('verification:update', { status: 'approved', verified: true, reason: '' });
  res.json({ ok: true });
});

router.post('/users/:id/unverify', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { verified: false, verificationStatus: 'none', verificationRejectReason: '' },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const io = req.app.get('io');
  if (io) io.to(`user:${user._id}`).emit('verification:update', { status: 'none', verified: false, reason: '' });
  res.json({ ok: true });
});

router.post('/users/:id/reject', requireAdmin, async (req, res) => {
  const reason = (req.body.reason || 'Documents non conformes').slice(0, 300);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { verified: false, verificationStatus: 'rejected', verificationRejectReason: reason },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const io = req.app.get('io');
  if (io) io.to(`user:${user._id}`).emit('verification:update', { status: 'rejected', verified: false, reason });
  res.json({ ok: true });
});

router.post('/users/:id/ban', adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true }, { new: true });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});

router.post('/users/:id/unban', adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false }, { new: true });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});

router.post('/users/:id/message', adminOnly, async (req, res) => {
  const message = (req.body.message || '').trim().slice(0, 1000);
  if (!message) return res.status(400).json({ error: 'Message vide' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const doc = await AdminMessage.create({ user: user._id, message });
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${user._id}`).emit('admin:message', {
      id: doc._id,
      message: doc.message,
      createdAt: doc.createdAt,
    });
  }
  res.json({ ok: true });
});

router.get('/matches', adminOnly, async (req, res) => {
  const { page = 1 } = req.query;
  const limit = 20;
  const total = await Conversation.countDocuments({});
  const conversations = await Conversation.find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('participants', 'name photos mainPhotoIndex verified');

  res.json({
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    matches: conversations.map((c) => ({
      id: c._id,
      createdAt: c.createdAt,
      users: c.participants
        .filter(Boolean)
        .map((p) => ({
          id: p._id,
          name: p.name,
          photo: p.photos[p.mainPhotoIndex]?.url || p.photos[0]?.url || null,
          verified: p.verified,
        })),
    })),
  });
});

module.exports = router;
