const express = require('express');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function assertParticipant(conversationId, userId) {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  const conv = await Conversation.findById(conversationId);
  if (!conv) return null;
  if (!conv.participants.some((p) => String(p) === String(userId))) return null;
  return conv;
}

router.get('/:conversationId/messages', requireAuth, async (req, res) => {
  try {
    const conv = await assertParticipant(req.params.conversationId, req.session.userId);
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    const messages = await Message.find({ conversation: conv._id }).sort({ createdAt: 1 }).limit(200);

    await Message.updateMany(
      { conversation: conv._id, sender: { $ne: req.session.userId }, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.json({
      messages: messages.map((m) => ({
        id: m._id,
        conversationId: m.conversation,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
        readAt: m.readAt,
        isMine: String(m.sender) === String(req.session.userId),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des messages' });
  }
});

router.post('/:conversationId/messages', requireAuth, async (req, res) => {
  try {
    const conv = await assertParticipant(req.params.conversationId, req.session.userId);
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message vide' });
    if (text.length > 2000) return res.status(400).json({ error: 'Message trop long' });

    const message = await Message.create({
      conversation: conv._id,
      sender: req.session.userId,
      text,
    });

    conv.lastMessage = text;
    conv.lastMessageAt = message.createdAt;
    conv.lastSender = req.session.userId;
    await conv.save();

    const payload = {
      id: message._id,
      conversationId: conv._id,
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt,
      readAt: null,
    };

    const io = req.app.get('io');
    if (io) {
      const otherId = conv.participants.find((p) => String(p) !== String(req.session.userId));
      io.to(`user:${otherId}`).emit('message:new', payload);
      io.to(`user:${req.session.userId}`).emit('message:new', payload);
    }

    res.status(201).json({ message: { ...payload, isMine: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

module.exports = router;
