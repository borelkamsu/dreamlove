const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmailCode = require('../models/EmailCode');
const { isValidEmail, isAdult } = require('../utils/validators');
const { RELATIONSHIP_STATUSES, sanitizeLanguages, parseHeight } = require('../utils/profileOptions');
const { sendVerificationCode } = require('../utils/mailer');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// Validates the registration form; returns { error } or { data }
async function validateRegistration(body) {
  const { email, password, name, birthdate, gender, seeking, country, location, originCountry, relationshipStatus } = body;
  let { preferredAgeMin, preferredAgeMax } = body;

  if (!email || !password || !name || !birthdate || !gender || !seeking || !country) {
    return { error: 'Tous les champs sont requis' };
  }
  if (!isValidEmail(email)) return { error: 'Email invalide' };
  if (password.length < 6) return { error: 'Le mot de passe doit contenir au moins 6 caracteres' };
  if (!isAdult(birthdate)) return { error: 'Vous devez avoir au moins 18 ans' };

  const height = parseHeight(body.height);
  if (height === undefined) return { error: 'Taille invalide (entre 120 et 230 cm)' };
  const languages = sanitizeLanguages(body.languages);
  if (languages.length === 0) return { error: 'Indiquez au moins une langue parlee' };

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return { error: 'Un compte existe deja avec cet email', status: 409 };

  preferredAgeMin = parseInt(preferredAgeMin, 10);
  preferredAgeMax = parseInt(preferredAgeMax, 10);
  if (Number.isNaN(preferredAgeMin) || preferredAgeMin < 18 || preferredAgeMin > 99) preferredAgeMin = 18;
  if (Number.isNaN(preferredAgeMax) || preferredAgeMax < 18 || preferredAgeMax > 99) preferredAgeMax = 99;
  if (preferredAgeMin > preferredAgeMax) [preferredAgeMin, preferredAgeMax] = [preferredAgeMax, preferredAgeMin];

  return {
    data: {
      email: email.toLowerCase().trim(),
      password,
      name,
      birthdate,
      gender,
      seeking,
      country,
      location: location || '',
      originCountry: originCountry || '',
      relationshipStatus: RELATIONSHIP_STATUSES.includes(relationshipStatus) ? relationshipStatus : 'celibataire',
      height,
      languages,
      preferredAgeMin,
      preferredAgeMax,
    },
  };
}

router.post('/register/send-code', async (req, res) => {
  try {
    const { error, status } = await validateRegistration(req.body);
    if (error) return res.status(status || 400).json({ error });

    const email = req.body.email.toLowerCase().trim();
    const previous = await EmailCode.findOne({ email });
    if (previous && Date.now() - previous.lastSentAt.getTime() < RESEND_DELAY_MS) {
      const wait = Math.ceil((RESEND_DELAY_MS - (Date.now() - previous.lastSentAt.getTime())) / 1000);
      return res.status(429).json({ error: `Patientez ${wait} s avant de demander un nouveau code` });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await EmailCode.findOneAndUpdate(
      { email },
      { codeHash: hashCode(code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      await sendVerificationCode(email, code);
    } catch (mailErr) {
      console.error('Envoi du code impossible:', mailErr);
      await EmailCode.deleteOne({ email });
      return res.status(502).json({ error: "Impossible d'envoyer l'email. Verifiez l'adresse et reessayez." });
    }

    res.json({ ok: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'envoi du code" });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { error, status, data } = await validateRegistration(req.body);
    if (error) return res.status(status || 400).json({ error });

    const code = String(req.body.code || '').trim();
    const entry = await EmailCode.findOne({ email: data.email });
    if (!entry || entry.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Code expire ou introuvable, demandez un nouveau code' });
    }
    if (entry.attempts >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ error: 'Trop de tentatives, demandez un nouveau code' });
    }
    if (entry.codeHash !== hashCode(code)) {
      entry.attempts += 1;
      await entry.save();
      return res.status(400).json({ error: 'Code de verification incorrect' });
    }

    const hash = await bcrypt.hash(data.password, 10);
    const user = await User.create({ ...data, password: hash, emailVerified: true });
    await EmailCode.deleteOne({ email: data.email });

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
