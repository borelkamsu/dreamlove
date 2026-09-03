const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

function calculateAge(birthdate) {
  const diffMs = Date.now() - new Date(birthdate).getTime();
  return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
}

function isAdult(birthdate) {
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return false;
  return calculateAge(d) >= 18;
}

module.exports = { isValidEmail, calculateAge, isAdult };
