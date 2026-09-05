const mongoose = require('mongoose');

const adminMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

adminMessageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AdminMessage', adminMessageSchema);
