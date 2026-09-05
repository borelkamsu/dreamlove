const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadBuffer, cloudinary } = require('../config/cloudinary');
const { INTERESTS } = require('../utils/interests');

const router = express.Router();

router.put('/', requireAuth, async (req, res) => {
  try {
    const { name, bio, location, seeking, country, originCountry, interests, relationshipStatus } = req.body;
    let { preferredAgeMin, preferredAgeMax, maxDistance } = req.body;
    const RELATIONSHIP_STATUSES = ['celibataire', 'en_couple', 'fiance', 'marie', 'divorce', 'veuf', 'complique'];
    const update = {};
    if (name !== undefined) update.name = name;
    if (bio !== undefined) update.bio = bio.slice(0, 500);
    if (location !== undefined) update.location = location;
    if (seeking !== undefined) update.seeking = seeking;
    if (country !== undefined) update.country = country;
    if (originCountry !== undefined) update.originCountry = originCountry;
    if (relationshipStatus !== undefined && RELATIONSHIP_STATUSES.includes(relationshipStatus)) {
      update.relationshipStatus = relationshipStatus;
    }
    if (maxDistance !== undefined) {
      maxDistance = parseInt(maxDistance, 10);
      update.maxDistance = Number.isNaN(maxDistance) || maxDistance <= 0 ? null : maxDistance;
    }
    if (preferredAgeMin !== undefined || preferredAgeMax !== undefined) {
      preferredAgeMin = parseInt(preferredAgeMin, 10);
      preferredAgeMax = parseInt(preferredAgeMax, 10);
      if (!Number.isNaN(preferredAgeMin) && preferredAgeMin >= 18 && preferredAgeMin <= 99) {
        update.preferredAgeMin = preferredAgeMin;
      }
      if (!Number.isNaN(preferredAgeMax) && preferredAgeMax >= 18 && preferredAgeMax <= 99) {
        update.preferredAgeMax = preferredAgeMax;
      }
      if (update.preferredAgeMin && update.preferredAgeMax && update.preferredAgeMin > update.preferredAgeMax) {
        [update.preferredAgeMin, update.preferredAgeMax] = [update.preferredAgeMax, update.preferredAgeMin];
      }
    }
    if (interests !== undefined) {
      if (!Array.isArray(interests)) {
        return res.status(400).json({ error: 'Centres d\'intérêt invalides' });
      }
      update.interests = interests.filter((i) => INTERESTS.includes(i)).slice(0, 10);
    }

    const user = await User.findByIdAndUpdate(req.session.userId, update, { new: true });
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour du profil' });
  }
});

router.put('/location', requireAuth, async (req, res) => {
  try {
    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordonnées invalides' });
    }
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { geo: { type: 'Point', coordinates: [lng, lat] } },
      { new: true }
    );
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la position' });
  }
});

router.post('/photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune photo envoyee' });
    const user = await User.findById(req.session.userId);
    if (user.photos.length >= 6) {
      return res.status(400).json({ error: 'Maximum 6 photos' });
    }
    const publicId = `${user._id}_${Date.now()}`;
    const result = await uploadBuffer(req.file.buffer, 'dreamlove/photos', publicId);
    user.photos.push({ url: result.secure_url, publicId: result.public_id });
    await user.save();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la photo' });
  }
});

router.delete('/photo/:index', requireAuth, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const user = await User.findById(req.session.userId);
    const photo = user.photos[index];
    if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

    await cloudinary.uploader.destroy(photo.publicId).catch(() => {});
    user.photos.splice(index, 1);
    if (user.mainPhotoIndex >= user.photos.length) user.mainPhotoIndex = 0;
    await user.save();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo' });
  }
});

router.put('/photo/:index/main', requireAuth, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const user = await User.findById(req.session.userId);
    if (!user.photos[index]) return res.status(404).json({ error: 'Photo introuvable' });
    user.mainPhotoIndex = index;
    await user.save();
    res.json({ user: user.toPublicJSON(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post(
  '/verify',
  requireAuth,
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      if (!files.idFront || !files.idBack || !files.selfie) {
        return res.status(400).json({ error: 'Recto, verso et selfie sont requis' });
      }
      const user = await User.findById(req.session.userId);

      const [idFront, idBack, selfie] = await Promise.all([
        uploadBuffer(files.idFront[0].buffer, 'dreamlove/verifications', `${user._id}_front`),
        uploadBuffer(files.idBack[0].buffer, 'dreamlove/verifications', `${user._id}_back`),
        uploadBuffer(files.selfie[0].buffer, 'dreamlove/verifications', `${user._id}_selfie`),
      ]);

      user.verificationDocs = {
        idFront: { url: idFront.secure_url, publicId: idFront.public_id },
        idBack: { url: idBack.secure_url, publicId: idBack.public_id },
        selfie: { url: selfie.secure_url, publicId: selfie.public_id },
      };
      user.verificationStatus = 'pending';
      user.verificationRejectReason = '';
      await user.save();

      const io = req.app.get('io');
      if (io) {
        io.to('admins').emit('admin:new-verification', {
          userId: user._id,
          name: user.name,
          email: user.email,
        });
      }

      res.json({ verificationStatus: user.verificationStatus });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de l\'envoi des documents' });
    }
  }
);

router.get('/verification-status', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json({
    verified: user.verified,
    verificationStatus: user.verificationStatus,
    verificationRejectReason: user.verificationRejectReason,
  });
});

module.exports = router;
