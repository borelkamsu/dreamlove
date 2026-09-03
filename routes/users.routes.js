const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const user = await User.findById(req.params.id);
    if (!user || user.isBanned) {
      return res.status(404).json({ error: 'Profil introuvable' });
    }
    res.json({ user: user.toPublicJSON(req.session.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement du profil' });
  }
});

module.exports = router;
