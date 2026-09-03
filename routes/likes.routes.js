const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:userId', requireAuth, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    if (targetId === req.session.userId) {
      return res.status(400).json({ error: 'Action impossible sur son propre profil' });
    }

    const me = await User.findById(req.session.userId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Profil introuvable' });

    if (!me.likes.some((id) => String(id) === targetId)) {
      me.likes.push(targetId);
    }

    let isMatch = false;
    let conversation = null;

    if (target.likes.some((id) => String(id) === String(me._id))) {
      isMatch = true;
      if (!me.matches.some((id) => String(id) === targetId)) me.matches.push(targetId);
      if (!target.matches.some((id) => String(id) === String(me._id))) {
        target.matches.push(me._id);
        await target.save();
      }

      conversation = await Conversation.findOne({
        participants: { $all: [me._id, target._id], $size: 2 },
      });
      if (!conversation) {
        conversation = await Conversation.create({ participants: [me._id, target._id] });
      }
    }

    await me.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetId}`).emit('like:received', { fromUserId: me._id });
      if (isMatch) {
        io.to(`user:${targetId}`).emit('match:new', {
          user: me.toPublicJSON(target._id),
          conversationId: conversation._id,
        });
      }
    }

    res.json({
      isMatch,
      conversationId: conversation ? conversation._id : null,
      matchedUser: isMatch ? target.toPublicJSON(me._id) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du like' });
  }
});

router.post('/:userId/pass', requireAuth, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const me = await User.findById(req.session.userId);
    if (!me.passes.some((id) => String(id) === targetId)) {
      me.passes.push(targetId);
      await me.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
