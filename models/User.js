const mongoose = require('mongoose');
const { RELATIONSHIP_STATUSES } = require('../utils/profileOptions');

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const verificationDocsSchema = new mongoose.Schema(
  {
    idFront: { url: String, publicId: String },
    idBack: { url: String, publicId: String },
    selfie: { url: String, publicId: String },
  },
  { _id: false }
);

const geoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    birthdate: { type: Date, required: true },
    gender: { type: String, enum: ['homme', 'femme', 'autre'], required: true },
    seeking: { type: String, enum: ['homme', 'femme', 'tous'], required: true },
    bio: { type: String, default: '', maxlength: 500 },
    location: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    originCountry: { type: String, default: '', trim: true },
    // Allowed values are enforced in the routes; older accounts may still hold retired values
    relationshipStatus: { type: String, default: 'celibataire' },
    height: { type: Number, default: null },
    languages: { type: [String], default: [] },
    preferredAgeMin: { type: Number, default: 18 },
    preferredAgeMax: { type: Number, default: 99 },
    maxDistance: { type: Number, default: null },
    geo: { type: geoSchema, default: undefined },
    interests: { type: [String], default: [] },

    photos: { type: [photoSchema], default: [] },
    mainPhotoIndex: { type: Number, default: 0 },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    verified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    verificationRejectReason: { type: String, default: '' },
    verificationDocs: { type: verificationDocsSchema, default: () => ({}) },

    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ geo: '2dsphere' });

userSchema.methods.toPublicJSON = function (viewerId) {
  const age = Math.floor((Date.now() - this.birthdate.getTime()) / (365.25 * 24 * 3600 * 1000));
  return {
    id: this._id,
    name: this.name,
    age,
    gender: this.gender,
    seeking: this.seeking,
    bio: this.bio,
    location: this.location,
    country: this.country,
    originCountry: this.originCountry,
    relationshipStatus: RELATIONSHIP_STATUSES.includes(this.relationshipStatus) ? this.relationshipStatus : '',
    height: this.height || null,
    languages: this.languages || [],
    preferredAgeMin: this.preferredAgeMin,
    preferredAgeMax: this.preferredAgeMax,
    maxDistance: this.maxDistance,
    hasLocation: !!(this.geo && Array.isArray(this.geo.coordinates) && this.geo.coordinates.length === 2),
    interests: this.interests,
    photos: this.photos.map((p) => p.url),
    mainPhotoIndex: this.mainPhotoIndex,
    verified: this.verified,
    online: this.online,
    lastSeen: this.lastSeen,
    isSelf: viewerId ? String(viewerId) === String(this._id) : false,
  };
};

module.exports = mongoose.model('User', userSchema);
