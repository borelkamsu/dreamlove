const Admin = require('../models/Admin');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifie' });
  }
  next();
}

function clearAdminSession(session) {
  session.isAdmin = false;
  delete session.adminId;
  delete session.adminRole;
  delete session.adminUsername;
}

// Resolves the staff member behind the session into req.admin = { id, username, role }.
// Accounts stored in the database are re-read on every request so that a role change or a
// deletion takes effect immediately. The account from the .env file (adminId null) is a full admin.
async function loadAdmin(req) {
  if (!req.session || !req.session.isAdmin) return null;
  if (!req.session.adminId) {
    return { id: null, username: req.session.adminUsername || process.env.ADMIN_USER, role: 'admin' };
  }
  const admin = await Admin.findById(req.session.adminId);
  if (!admin) {
    clearAdminSession(req.session);
    return null;
  }
  req.session.adminRole = admin.role;
  return { id: String(admin._id), username: admin.username, role: admin.role };
}

function requireAdmin(req, res, next) {
  loadAdmin(req)
    .then((admin) => {
      if (!admin) return res.status(401).json({ error: 'Acces admin requis' });
      req.admin = admin;
      next();
    })
    .catch(next);
}

// Restricts a route to staff with one of the given roles (requireAdmin must run first)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Action reservee aux administrateurs' });
    }
    next();
  };
}

module.exports = { requireAuth, requireAdmin, requireRole, loadAdmin, clearAdminSession };
