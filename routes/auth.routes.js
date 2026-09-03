const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { isValidEmail, isAdult } = require('../utils/validators');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, birthdate, gender, seeking, country, location, originCountry, relationshipStatus } = req.body;
    let { preferredAgeMin, preferredAgeMax } = req.body;
    const RELATIONSHIP_STATUSES = ['celibataire', 'en_couple', 'fiance', 'marie', 'divorce', 'veuf', 'complique'];

    if (!email || !password || !name || !birthdate || !gender || !seeking || !country) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
    }
    if (!isAdult(birthdate)) {
      return res.status(400).json({ error: 'Vous devez avoir au moins 18 ans' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe deja avec cet email' });
    }

    preferredAgeMin = parseInt(preferredAgeMin, 10);
    preferredAgeMax = parseInt(preferredAgeMax, 10);
    if (Number.isNaN(preferredAgeMin) || preferredAgeMin < 18 || preferredAgeMin > 99) preferredAgeMin = 18;
    if (Number.isNaN(preferredAgeMax) || preferredAgeMax < 18 || preferredAgeMax > 99) preferredAgeMax = 99;
    if (preferredAgeMin > preferredAgeMax) [preferredAgeMin, preferredAgeMax] = [preferredAgeMax, preferredAgeMin];

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hash,
      name,
      birthdate,
      gender,
      seeking,
      country,
      location: location || '',
      originCountry: originCountry || '',
      relationshipStatus: RELATIONSHIP_STATUSES.includes(relationshipStatus) ? relationshipStatus : 'celibataire',
      preferredAgeMin,
      preferredAgeMax,
    });

    req.session.userId = user._id.toString();
    res.status(201).json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Ce compte a ete suspendu' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    req.session.userId = user._id.toString();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user: user.toPublicJSON(user._id) });
});

module.exports = router;
