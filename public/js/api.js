const api = {
  async request(method, url, body, isForm) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (body) {
      if (isForm) {
        opts.body = body;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Une erreur est survenue');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) {
    return this.request('GET', url);
  },
  post(url, body, isForm) {
    return this.request('POST', url, body, isForm);
  },
  put(url, body, isForm) {
    return this.request('PUT', url, body, isForm);
  },
  del(url) {
    return this.request('DELETE', url);
  },
};

function showToast(message, duration = 2600) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function verifiedBadgeHTML() {
  return '<span class="verified-badge" title="Compte certifié"><i class="fa-solid fa-check"></i></span>';
}

function goToProfile(userId) {
  window.location.href = `/profile.html?id=${encodeURIComponent(userId)}`;
}

const RELATIONSHIP_STATUS_LABELS = {
  celibataire: 'Célibataire',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf / Veuve',
  complique: "C'est compliqué",
};

function relationshipStatusLabel(value) {
  return RELATIONSHIP_STATUS_LABELS[value] || '';
}

function heightLabel(cm) {
  if (!cm) return '';
  const m = Math.floor(cm / 100);
  return `${m},${String(cm % 100).padStart(2, '0')} m`;
}

const COUNTRY_ISO_CODES = {
  'Afghanistan': 'AF', 'Afrique du Sud': 'ZA', 'Albanie': 'AL', 'Algérie': 'DZ', 'Allemagne': 'DE',
  'Andorre': 'AD', 'Angola': 'AO', 'Arabie saoudite': 'SA', 'Argentine': 'AR', 'Arménie': 'AM',
  'Australie': 'AU', 'Autriche': 'AT', 'Azerbaïdjan': 'AZ', 'Bahamas': 'BS', 'Bahreïn': 'BH',
  'Bangladesh': 'BD', 'Belgique': 'BE', 'Belize': 'BZ', 'Bénin': 'BJ', 'Bhoutan': 'BT',
  'Biélorussie': 'BY', 'Birmanie': 'MM', 'Bolivie': 'BO', 'Bosnie-Herzégovine': 'BA', 'Botswana': 'BW',
  'Brésil': 'BR', 'Brunei': 'BN', 'Bulgarie': 'BG', 'Burkina Faso': 'BF', 'Burundi': 'BI',
  'Cambodge': 'KH', 'Cameroun': 'CM', 'Canada': 'CA', 'Cap-Vert': 'CV', 'Chili': 'CL',
  'Chine': 'CN', 'Chypre': 'CY', 'Colombie': 'CO', 'Comores': 'KM', 'Congo': 'CG',
  'Congo (RDC)': 'CD', 'Corée du Nord': 'KP', 'Corée du Sud': 'KR', 'Costa Rica': 'CR',
  "Côte d'Ivoire": 'CI', 'Croatie': 'HR', 'Cuba': 'CU', 'Danemark': 'DK', 'Djibouti': 'DJ',
  'Dominique': 'DM', 'Égypte': 'EG', 'Émirats arabes unis': 'AE', 'Équateur': 'EC', 'Érythrée': 'ER',
  'Espagne': 'ES', 'Estonie': 'EE', 'Eswatini': 'SZ', 'États-Unis': 'US', 'Éthiopie': 'ET',
  'Fidji': 'FJ', 'Finlande': 'FI', 'France': 'FR', 'Gabon': 'GA', 'Gambie': 'GM',
  'Géorgie': 'GE', 'Ghana': 'GH', 'Grèce': 'GR', 'Grenade': 'GD', 'Guatemala': 'GT',
  'Guinée': 'GN', 'Guinée-Bissau': 'GW', 'Guinée équatoriale': 'GQ', 'Guyana': 'GY',
  'Haïti': 'HT', 'Honduras': 'HN', 'Hongrie': 'HU', 'Inde': 'IN', 'Indonésie': 'ID',
  'Irak': 'IQ', 'Iran': 'IR', 'Irlande': 'IE', 'Islande': 'IS', 'Israël': 'IL', 'Italie': 'IT',
  'Jamaïque': 'JM', 'Japon': 'JP', 'Jordanie': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE',
  'Kirghizistan': 'KG', 'Kiribati': 'KI', 'Koweït': 'KW', 'Laos': 'LA', 'Lesotho': 'LS',
  'Lettonie': 'LV', 'Liban': 'LB', 'Liberia': 'LR', 'Libye': 'LY', 'Liechtenstein': 'LI',
  'Lituanie': 'LT', 'Luxembourg': 'LU', 'Macédoine du Nord': 'MK', 'Madagascar': 'MG',
  'Malaisie': 'MY', 'Malawi': 'MW', 'Maldives': 'MV', 'Mali': 'ML', 'Malte': 'MT',
  'Maroc': 'MA', 'Maurice': 'MU', 'Mauritanie': 'MR', 'Mexique': 'MX', 'Micronésie': 'FM',
  'Moldavie': 'MD', 'Monaco': 'MC', 'Mongolie': 'MN', 'Monténégro': 'ME', 'Mozambique': 'MZ',
  'Namibie': 'NA', 'Nauru': 'NR', 'Népal': 'NP', 'Nicaragua': 'NI', 'Niger': 'NE',
  'Nigeria': 'NG', 'Norvège': 'NO', 'Nouvelle-Zélande': 'NZ', 'Oman': 'OM', 'Ouganda': 'UG',
  'Ouzbékistan': 'UZ', 'Pakistan': 'PK', 'Palaos': 'PW', 'Palestine': 'PS', 'Panama': 'PA',
  'Papouasie-Nouvelle-Guinée': 'PG', 'Paraguay': 'PY', 'Pays-Bas': 'NL', 'Pérou': 'PE',
  'Philippines': 'PH', 'Pologne': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
  'République centrafricaine': 'CF', 'République dominicaine': 'DO', 'République tchèque': 'CZ',
  'Roumanie': 'RO', 'Royaume-Uni': 'GB', 'Russie': 'RU', 'Rwanda': 'RW',
  'Saint-Kitts-et-Nevis': 'KN', 'Saint-Marin': 'SM', 'Saint-Vincent-et-les-Grenadines': 'VC',
  'Sainte-Lucie': 'LC', 'Salomon': 'SB', 'Salvador': 'SV', 'Samoa': 'WS',
  'Sao Tomé-et-Principe': 'ST', 'Sénégal': 'SN', 'Serbie': 'RS', 'Seychelles': 'SC',
  'Sierra Leone': 'SL', 'Singapour': 'SG', 'Slovaquie': 'SK', 'Slovénie': 'SI', 'Somalie': 'SO',
  'Soudan': 'SD', 'Soudan du Sud': 'SS', 'Sri Lanka': 'LK', 'Suède': 'SE', 'Suisse': 'CH',
  'Suriname': 'SR', 'Syrie': 'SY', 'Tadjikistan': 'TJ', 'Tanzanie': 'TZ', 'Tchad': 'TD',
  'Thaïlande': 'TH', 'Timor oriental': 'TL', 'Togo': 'TG', 'Tonga': 'TO',
  'Trinité-et-Tobago': 'TT', 'Tunisie': 'TN', 'Turkménistan': 'TM', 'Turquie': 'TR', 'Tuvalu': 'TV',
  'Ukraine': 'UA', 'Uruguay': 'UY', 'Vanuatu': 'VU', 'Vatican': 'VA', 'Venezuela': 'VE',
  'Viêt Nam': 'VN', 'Yémen': 'YE', 'Zambie': 'ZM', 'Zimbabwe': 'ZW',
};

function countryFlagEmoji(countryName) {
  const code = COUNTRY_ISO_CODES[countryName];
  if (!code) return '';
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function requestAndShareLocation() {
  return new Promise((resolve) => {
    if (typeof State !== 'undefined' && State.user && State.user.hasLocation) {
      resolve(true);
      return;
    }
    if (!navigator.geolocation) {
      showToast('Géolocalisation non disponible sur cet appareil');
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { user } = await api.put('/api/profile/location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (typeof State !== 'undefined') State.user = user;
          resolve(true);
        } catch (err) {
          showToast(err.message);
          resolve(false);
        }
      },
      () => {
        showToast('Position refusée : le filtre de distance ne peut pas être appliqué');
        resolve(false);
      },
      { timeout: 10000 }
    );
  });
}
