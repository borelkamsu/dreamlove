const CITIES_BY_COUNTRY = {
  'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Toulon', 'Grenoble', 'Dijon'],
  'Belgique': ['Bruxelles', 'Anvers', 'Gand', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Louvain', 'Mons'],
  'Suisse': ['Genève', 'Zurich', 'Lausanne', 'Bâle', 'Berne', 'Fribourg', 'Neuchâtel', 'Sion'],
  'Canada': ['Montréal', 'Québec', 'Toronto', 'Ottawa', 'Gatineau', 'Vancouver', 'Sherbrooke', 'Trois-Rivières'],
  'États-Unis': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Boston', 'Atlanta', 'Washington'],
  'Royaume-Uni': ['Londres', 'Manchester', 'Birmingham', 'Liverpool', 'Glasgow', 'Édimbourg', 'Bristol'],
  'Allemagne': ['Berlin', 'Munich', 'Hambourg', 'Cologne', 'Francfort', 'Stuttgart', 'Düsseldorf'],
  'Espagne': ['Madrid', 'Barcelone', 'Valence', 'Séville', 'Malaga', 'Bilbao'],
  'Italie': ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venise', 'Bologne'],
  'Portugal': ['Lisbonne', 'Porto', 'Braga', 'Coimbra', 'Faro'],
  'Maroc': ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès'],
  'Algérie': ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida'],
  'Tunisie': ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte'],
  'Cameroun': ['Yaoundé', 'Douala', 'Garoua', 'Bafoussam', 'Bamenda', 'Maroua', 'Ngaoundéré'],
  "Côte d'Ivoire": ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro', 'Korhogo'],
  'Sénégal': ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Touba'],
  'Mali': ['Bamako', 'Sikasso', 'Mopti', 'Kayes', 'Ségou'],
  'Bénin': ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey'],
  'Togo': ['Lomé', 'Sokodé', 'Kara', 'Kpalimé'],
  'Gabon': ['Libreville', 'Port-Gentil', 'Franceville'],
  'Congo': ['Brazzaville', 'Pointe-Noire', 'Dolisie'],
  'Congo (RDC)': ['Kinshasa', 'Lubumbashi', 'Goma', 'Bukavu', 'Kisangani'],
  'Burkina Faso': ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou'],
  'Niger': ['Niamey', 'Zinder', 'Maradi'],
  'Guinée': ['Conakry', 'Kankan', 'Labé'],
  'Madagascar': ['Antananarivo', 'Toamasina', 'Antsirabe'],
  'Rwanda': ['Kigali', 'Butare', 'Gisenyi'],
  'Haïti': ['Port-au-Prince', 'Cap-Haïtien', 'Gonaïves'],
};

function renderCityField(hostEl, country, selectedValue) {
  hostEl.innerHTML = '';
  const cities = CITIES_BY_COUNTRY[country];
  if (cities && cities.length) {
    const select = document.createElement('select');
    select.id = hostEl.dataset.fieldId || '';
    select.name = hostEl.dataset.fieldName || '';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'Choisir une ville';
    select.appendChild(emptyOpt);
    cities.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === selectedValue) opt.selected = true;
      select.appendChild(opt);
    });
    if (selectedValue && !cities.includes(selectedValue)) {
      const customOpt = document.createElement('option');
      customOpt.value = selectedValue;
      customOpt.textContent = selectedValue;
      customOpt.selected = true;
      select.appendChild(customOpt);
    }
    hostEl.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = hostEl.dataset.fieldId || '';
    input.name = hostEl.dataset.fieldName || '';
    input.placeholder = 'Votre ville';
    input.maxLength = 80;
    if (selectedValue) input.value = selectedValue;
    hostEl.appendChild(input);
  }
}

function getCityFieldValue(hostEl) {
  const el = hostEl.querySelector('select, input');
  return el ? el.value.trim() : '';
}
