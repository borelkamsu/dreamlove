const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Identifiants administrateur invalides' });
});

router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

router.get('/stats', requireAdmin, async (req, res) => {
  const [totalUsers, verifiedUsers, pendingVerifications, totalMatches, totalMessages, onlineNow] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ verified: true }),
      User.countDocuments({ verificationStatus: 'pending' }),
      Conversation.countDocuments({}),
      Message.countDocuments({}),
      User.countDocuments({ online: true }),
    ]);
  res.json({ totalUsers, verifiedUsers, pendingVerifications, totalMatches, totalMessages, onlineNow });
});

router.get('/users', requireAdmin, async (req, res) => {
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
  res.json({ ok: true });
});

router.post('/users/:id/unverify', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { verified: false, verificationStatus: 'none', verificationRejectReason: '' },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
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
  res.json({ ok: true });
});

router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true }, { new: true });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});

router.post('/users/:id/unban', requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false }, { new: true });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ ok: true });
});

router.get('/matches', requireAdmin, async (req, res) => {
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
