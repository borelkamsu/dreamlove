const express = require('express');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
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

    res.json({ likesCount, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des notifications' });
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
