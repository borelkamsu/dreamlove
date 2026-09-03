const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    const genderFilter = me.seeking === 'tous' ? {} : { gender: me.seeking };

    const baseQuery = {
      isBanned: false,
      ...genderFilter,
    };

    const { country, city, q, minAge, maxAge, maxDistance } = req.query;
    if (country) baseQuery.country = country;
    if (city) baseQuery.location = new RegExp(`^${city.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (q) {
      const regex = new RegExp(q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      baseQuery.$or = [{ name: regex }, { bio: regex }, { location: regex }];
    }
    const yearMs = 365.25 * 24 * 3600 * 1000;
    let minAgeNum = parseInt(minAge, 10);
    let maxAgeNum = parseInt(maxAge, 10);
    if (Number.isNaN(minAgeNum)) minAgeNum = me.preferredAgeMin || 0;
    if (Number.isNaN(maxAgeNum)) maxAgeNum = me.preferredAgeMax || 0;
    if (minAgeNum > 0) {
      baseQuery.birthdate = { ...baseQuery.birthdate, $lte: new Date(Date.now() - minAgeNum * yearMs) };
    }
    if (maxAgeNum > 0 && maxAgeNum < 99) {
      baseQuery.birthdate = { ...baseQuery.birthdate, $gte: new Date(Date.now() - (maxAgeNum + 1) * yearMs) };
    }

    let maxDistanceNum = parseInt(maxDistance, 10);
    if (Number.isNaN(maxDistanceNum)) maxDistanceNum = me.maxDistance || 0;
    const useGeo = maxDistanceNum > 0 && me.geo && Array.isArray(me.geo.coordinates) && me.geo.coordinates.length === 2;

    async function fetchCandidates(excludedIds) {
      const query = { ...baseQuery, _id: { $nin: excludedIds } };
      if (useGeo) {
        const docs = await User.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: me.geo.coordinates },
              distanceField: 'distanceMeters',
              maxDistance: maxDistanceNum * 1000,
              spherical: true,
              query,
            },
          },
          { $limit: 20 },
        ]);
        return docs.map((d) => {
          const json = User.hydrate(d).toPublicJSON(me._id);
          json.distanceKm = Math.round(d.distanceMeters / 1000);
          return json;
        });
      }
      const docs = await User.find(query).limit(20).sort({ createdAt: -1 });
      return docs.map((d) => d.toPublicJSON(me._id));
    }

    // Profils jamais vus (ni likés, ni passés, ni matchés) en priorité.
    const unseenExcluded = [me._id, ...me.likes, ...me.passes, ...me.matches];
    let profiles = await fetchCandidates(unseenExcluded);

    let recycled = false;
    if (profiles.length === 0 && (me.likes.length > 0 || me.passes.length > 0)) {
      // Plus rien de nouveau : on repropose les profils déjà likés ou passés (mais pas matchés,
      // puisqu'un match signifie qu'une conversation est déjà en cours avec cette personne).
      const matchedExcluded = [me._id, ...me.matches];
      profiles = await fetchCandidates(matchedExcluded);
      recycled = profiles.length > 0;
    }

    res.json({ profiles, recycled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des profils' });
  }
});

module.exports = router;
