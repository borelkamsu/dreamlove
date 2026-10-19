const RELATIONSHIP_STATUSES = ['celibataire', 'divorce', 'veuf', 'complique'];

const LANGUAGES = [
  'Français', 'Anglais', 'Espagnol', 'Portugais', 'Allemand', 'Italien', 'Néerlandais', 'Arabe',
  'Chinois', 'Russe', 'Turc', 'Hindi', 'Swahili', 'Lingala', 'Wolof', 'Bambara', 'Peul',
  'Yoruba', 'Igbo', 'Haoussa', 'Ewondo', 'Bassa', 'Douala', 'Fang', 'Kikongo', 'Tshiluba',
  'Créole', 'Malgache', 'Amharique', 'Zoulou', 'Twi', 'Fon', 'Moore', 'Sango', 'Kinyarwanda', 'Kirundi',
];

const HEIGHT_MIN = 120;
const HEIGHT_MAX = 230;

function sanitizeLanguages(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((l) => LANGUAGES.includes(l)))].slice(0, 8);
}

// Returns a height in cm, null when empty, or undefined when invalid
function parseHeight(value) {
  if (value === '' || value === null || value === undefined) return null;
  const h = parseInt(value, 10);
  if (Number.isNaN(h) || h < HEIGHT_MIN || h > HEIGHT_MAX) return undefined;
  return h;
}

module.exports = { RELATIONSHIP_STATUSES, LANGUAGES, HEIGHT_MIN, HEIGHT_MAX, sanitizeLanguages, parseHeight };
