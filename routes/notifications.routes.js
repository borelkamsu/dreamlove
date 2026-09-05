const express = require('express');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AdminMessage = require('../models/AdminMessage');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const likesCount = await User.countDocuments({
      likes: me._id,
      _id: { $nin: me.matches },
      isBanned: false,
    });

    const conversations = await Conversation.find({ participants: me._id }, '_id');
    const unreadCount = await Message.countDocuments({
      conversation: { $in: conversations.map((c) => c._id) },
      sender: { $ne: me._id },
      readAt: null,
    });

    const adminMessagesCount = await AdminMessage.countDocuments({ user: me._id, read: false });

    res.json({ likesCount, unreadCount, adminMessagesCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des notifications' });
  }
});

router.get('/admin-messages', requireAuth, async (req, res) => {
  try {
    const messages = await AdminMessage.find({ user: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({
      messages: messages.map((m) => ({
        id: m._id,
        message: m.message,
        createdAt: m.createdAt,
        read: m.read,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des messages' });
  }
});

router.post('/admin-messages/read', requireAuth, async (req, res) => {
  try {
    await AdminMessage.updateMany({ user: req.session.userId, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/likes-received', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const likers = await User.find({
      likes: me._id,
      _id: { $nin: me.matches },
      isBanned: false,
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ users: likers.map((u) => u.toPublicJSON(me._id)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des likes reçus' });
  }
});

module.exports = router;
