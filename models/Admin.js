const mongoose = require('mongoose');

// Staff accounts created from the admin panel.
// - admin  : full access, can create / edit / delete other staff accounts
// - editor : can only review and certify member accounts
const ADMIN_ROLES = ['admin', 'editor'];

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ADMIN_ROLES, default: 'editor' },
    createdBy: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    username: this.username,
    role: this.role,
    createdBy: this.createdBy,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

const Admin = mongoose.model('Admin', adminSchema);
Admin.ADMIN_ROLES = ADMIN_ROLES;

module.exports = Admin;
