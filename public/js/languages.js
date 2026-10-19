// Keep in sync with utils/profileOptions.js
const LANGUAGES = [
  'Français', 'Anglais', 'Espagnol', 'Portugais', 'Allemand', 'Italien', 'Néerlandais', 'Arabe',
  'Chinois', 'Russe', 'Turc', 'Hindi', 'Swahili', 'Lingala', 'Wolof', 'Bambara', 'Peul',
  'Yoruba', 'Igbo', 'Haoussa', 'Ewondo', 'Bassa', 'Douala', 'Fang', 'Kikongo', 'Tshiluba',
  'Créole', 'Malgache', 'Amharique', 'Zoulou', 'Twi', 'Fon', 'Moore', 'Sango', 'Kinyarwanda', 'Kirundi',
];
const MAX_LANGUAGES = 8;

// Renders selectable language chips into `host` and returns a getter for the current selection
function renderLanguageChips(host, initial) {
  let selected = (initial || []).filter((l) => LANGUAGES.includes(l));
  host.innerHTML = LANGUAGES.map(
    (l) => `<button type="button" class="chip ${selected.includes(l) ? 'selected' : ''}" data-language="${l}">${l}</button>`
  ).join('');
  host.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.language;
      if (selected.includes(value)) {
        selected = selected.filter((l) => l !== value);
      } else {
        if (selected.length >= MAX_LANGUAGES) {
          if (typeof showToast === 'function') showToast(`${MAX_LANGUAGES} langues maximum`);
          return;
        }
        selected.push(value);
      }
      chip.classList.toggle('selected');
    });
  });
  return () => selected.slice();
}
