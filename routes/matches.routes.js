const express = require('express');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { formatLastSeen } = require('../utils/lastSeen');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.session.userId).populate('matches');

    const conversations = await Conversation.find({ participants: me._id }).sort({ lastMessageAt: -1 });
    const convByOther = new Map();
    conversations.forEach((c) => {
      const otherId = c.participants.find((p) => String(p) !== String(me._id));
      if (otherId) convByOther.set(String(otherId), c);
    });

    const unreadCounts = await Message.aggregate([
      { $match: { conversation: { $in: conversations.map((c) => c._id) }, readAt: null, sender: { $ne: me._id } } },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]);
    const unreadByConv = new Map(unreadCounts.map((u) => [String(u._id), u.count]));

    const result = me.matches.map((other) => {
      const conv = convByOther.get(String(other._id));
      return {
        user: other.toPublicJSON(me._id),
        onlineLabel: other.online ? 'En ligne' : formatLastSeen(other.lastSeen),
        conversationId: conv ? conv._id : null,
        lastMessage: conv ? conv.lastMessage : '',
        lastMessageAt: conv ? conv.lastMessageAt : null,
        unreadCount: conv ? unreadByConv.get(String(conv._id)) || 0 : 0,
      };
    });

    result.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    res.json({ matches: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des matches' });
  }
});

module.exports = router;
