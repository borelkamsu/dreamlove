const DiscoverModule = (() => {
  let deck = [];
  let loading = false;
  let recycleNoticeShown = false;
  let filters = { country: '', city: '', q: '', minAge: '', maxAge: '', maxDistance: '' };

  function calcAge(profile) {
    return profile.age;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderStack() {
    const stack = document.getElementById('card-stack');
    stack.innerHTML = '';
    const visible = deck.slice(0, 2).reverse();
    visible.forEach((profile) => {
      const isTop = profile === deck[0];
      const card = renderCard(profile, isTop);
      if (!isTop) card.classList.add('card-behind');
      stack.appendChild(card);
    });
    if (deck.length === 0 && !loading) {
      stack.innerHTML = `
        <div class="empty-state" style="width:100%">
          <div class="icon"><i class="fa-solid fa-heart-crack"></i></div>
          <p>Plus de profils pour le moment.<br/>Essayez d'élargir vos filtres.</p>
        </div>`;
    }
  }

  function renderCard(profile, isTop) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    const photos = profile.photos && profile.photos.length ? profile.photos : ['/img/default-avatar.svg'];
    let photoIndex = profile.mainPhotoIndex && profile.mainPhotoIndex < photos.length ? profile.mainPhotoIndex : 0;

    const dotsHtml = photos.map((_, i) => `<span class="${i === photoIndex ? 'active' : ''}"></span>`).join('');
    const place = [profile.location, profile.country].filter(Boolean).join(', ');
    const interestsHtml = (profile.interests || [])
      .slice(0, 4)
      .map((i) => `<span>${escapeHtml(i)}</span>`)
      .join('');
    const relationshipLabel = relationshipStatusLabel(profile.relationshipStatus);

    card.innerHTML = `
      <div class="photo-wrap">
        <img src="${photos[photoIndex]}" alt="${escapeHtml(profile.name)}" />
        <div class="card-gradient"></div>
        <div class="heart-burst"><i class="fa-solid fa-heart"></i></div>
        ${photos.length > 1 ? `<div class="photo-dots">${dotsHtml}</div>` : ''}
        <button type="button" class="card-info-btn" data-action="info" title="Voir le profil"><i class="fa-solid fa-circle-info"></i></button>
        <div class="tap-zone left"></div>
        <div class="tap-zone right"></div>
        <div class="card-info">
          <h3><span class="card-name">${escapeHtml(profile.name)}, ${calcAge(profile)}</span> ${profile.verified ? verifiedBadgeHTML() : ''}</h3>
          ${place ? `<p><i class="fa-solid fa-location-dot"></i> ${escapeHtml(place)}</p>` : ''}
          ${profile.distanceKm != null ? `<p><i class="fa-solid fa-location-arrow"></i> À ${profile.distanceKm} km</p>` : ''}
          ${profile.originCountry ? `<p>${countryFlagEmoji(profile.originCountry)} Origine : ${escapeHtml(profile.originCountry)}</p>` : ''}
          ${relationshipLabel ? `<p><i class="fa-solid fa-heart-circle-check"></i> ${escapeHtml(relationshipLabel)}</p>` : ''}
          ${profile.height ? `<p><i class="fa-solid fa-ruler-vertical"></i> ${heightLabel(profile.height)}</p>` : ''}
          ${profile.languages && profile.languages.length ? `<p><i class="fa-solid fa-language"></i> ${escapeHtml(profile.languages.join(', '))}</p>` : ''}
          ${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ''}
          ${interestsHtml ? `<div class="interest-chips">${interestsHtml}</div>` : ''}
        </div>
        <div class="card-swipe-buttons">
          <button type="button" class="btn-icon pass" data-action="pass" title="Passer"><i class="fa-solid fa-xmark"></i></button>
          <button type="button" class="btn-icon like" data-action="like" title="J'aime"><i class="fa-solid fa-heart"></i></button>
        </div>
      </div>
    `;

    if (isTop) {
      const img = card.querySelector('img');
      const dotsEl = card.querySelector('.photo-dots');

      function showPhoto(i) {
        photoIndex = Math.max(0, Math.min(photos.length - 1, i));
        img.src = photos[photoIndex];
        if (dotsEl) {
          dotsEl.querySelectorAll('span').forEach((d, idx) => d.classList.toggle('active', idx === photoIndex));
        }
      }

      function bindZone(zone, dir) {
        let clickTimer = null;
        zone.addEventListener('click', () => {
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            triggerLikeAnimation(card);
            like(profile.id);
          } else {
            clickTimer = setTimeout(() => {
              clickTimer = null;
              showPhoto(photoIndex + dir);
            }, 250);
          }
        });
      }
      bindZone(card.querySelector('.tap-zone.left'), -1);
      bindZone(card.querySelector('.tap-zone.right'), 1);

      card.querySelector('[data-action="info"]').addEventListener('click', (e) => {
        e.stopPropagation();
        goToProfile(profile.id);
      });

      const nameEl = card.querySelector('.card-name');
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        goToProfile(profile.id);
      });

      card.querySelector('[data-action="pass"]').addEventListener('click', (e) => {
        e.stopPropagation();
        pass(profile.id);
      });
      card.querySelector('[data-action="like"]').addEventListener('click', (e) => {
        e.stopPropagation();
        triggerLikeAnimation(card);
        like(profile.id);
      });
    }
    return card;
  }

  function triggerLikeAnimation(card) {
    const burst = card.querySelector('.heart-burst');
    burst.classList.remove('play');
    void burst.offsetWidth;
    burst.classList.add('play');
  }

  function topCardEl() {
    const stack = document.getElementById('card-stack');
    return stack.querySelector('.profile-card:last-child');
  }

  async function like(id) {
    const card = topCardEl();
    if (card) card.classList.add('exit-like');
    try {
      const res = await api.post(`/api/likes/${id}`);
      setTimeout(() => {
        removeFromDeck(id);
        if (res.isMatch) showMatchModal(res.matchedUser, res.conversationId);
      }, card ? 300 : 0);
    } catch (err) {
      if (card) card.classList.remove('exit-like');
      showToast(err.message);
    }
  }

  async function pass(id) {
    const card = topCardEl();
    if (card) card.classList.add('exit-pass');
    try {
      await api.post(`/api/likes/${id}/pass`);
      setTimeout(() => removeFromDeck(id), card ? 300 : 0);
    } catch (err) {
      if (card) card.classList.remove('exit-pass');
      showToast(err.message);
    }
  }

  function removeFromDeck(id) {
    deck = deck.filter((p) => p.id !== id);
    renderStack();
    if (deck.length < 3) load();
  }

  function showMatchModal(otherUser, conversationId) {
    document.getElementById('match-avatar-me').src =
      (State.user.photos && State.user.photos[0]) || '/img/default-avatar.svg';
    document.getElementById('match-avatar-other').src =
      (otherUser.photos && otherUser.photos[0]) || '/img/default-avatar.svg';
    document.getElementById('match-text').textContent = `Vous et ${otherUser.name} vous êtes likés mutuellement.`;
    const modal = document.getElementById('match-modal');
    modal.classList.add('show');

    const sayHi = document.getElementById('match-say-hi');
    sayHi.onclick = () => {
      modal.classList.remove('show');
      switchView('messages');
      if (window.MatchesModule) window.MatchesModule.refresh();
      if (conversationId && window.ChatModule) {
        window.ChatModule.open(conversationId, otherUser);
      }
    };
    document.getElementById('match-close').onclick = () => modal.classList.remove('show');
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const params = new URLSearchParams();
      if (filters.country) params.set('country', filters.country);
      if (filters.city) params.set('city', filters.city);
      if (filters.q) params.set('q', filters.q);
      if (filters.minAge) params.set('minAge', filters.minAge);
      if (filters.maxAge) params.set('maxAge', filters.maxAge);
      if (filters.maxDistance) params.set('maxDistance', filters.maxDistance);
      const { profiles, recycled } = await api.get(`/api/discover?${params.toString()}`);
      const existingIds = new Set(deck.map((p) => p.id));
      profiles.forEach((p) => {
        if (!existingIds.has(p.id)) deck.push(p);
      });
      if (recycled && profiles.length > 0 && !recycleNoticeShown) {
        recycleNoticeShown = true;
        showToast('Vous avez vu tous les nouveaux profils : on vous remontre ceux que vous avez déjà likés ou passés.');
      }
      renderStack();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    deck = [];
    recycleNoticeShown = false;
    renderStack();
    load();
  }

  function updateGreeting() {
    const el = document.getElementById('discover-greeting');
    if (el && State.user) el.textContent = `Bonjour ${State.user.name}`;
  }

  let cityHost, countrySelect, searchInput, ageMinInput, ageMaxInput, distanceSelect;

  function updateFilterBadge() {
    const badge = document.getElementById('filter-active-badge');
    const active = !!(filters.country || filters.city || filters.q || filters.minAge || filters.maxAge || filters.maxDistance);
    badge.style.display = active ? 'flex' : 'none';
  }

  async function runSearch() {
    filters.country = countrySelect.value;
    filters.city = getCityFieldValue(cityHost);
    filters.q = searchInput.value.trim();
    filters.minAge = ageMinInput.value;
    filters.maxAge = ageMaxInput.value;
    if (distanceSelect.value) {
      const shared = await requestAndShareLocation();
      filters.maxDistance = shared ? distanceSelect.value : '';
      if (!shared) distanceSelect.value = '';
    } else {
      filters.maxDistance = '';
    }
    updateFilterBadge();
    document.getElementById('filter-modal').classList.remove('show');
    applyFilters();
  }

  function initFilterBar() {
    countrySelect = document.getElementById('filter-country');
    COUNTRIES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      countrySelect.appendChild(opt);
    });

    cityHost = document.getElementById('filter-city-host');
    renderCityField(cityHost, '', '');
    countrySelect.addEventListener('change', () => {
      renderCityField(cityHost, countrySelect.value, '');
    });

    searchInput = document.getElementById('filter-search');
    ageMinInput = document.getElementById('filter-age-min');
    ageMaxInput = document.getElementById('filter-age-max');
    distanceSelect = document.getElementById('filter-distance');

    document.getElementById('filter-submit').addEventListener('click', runSearch);
    [searchInput, ageMinInput, ageMaxInput].forEach((el) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearch();
      });
    });

    const filterModal = document.getElementById('filter-modal');
    document.getElementById('open-filter-btn').addEventListener('click', () => {
      filterModal.classList.add('show');
    });
    document.getElementById('filter-modal-close').addEventListener('click', () => {
      filterModal.classList.remove('show');
    });
    filterModal.addEventListener('click', (e) => {
      if (e.target.id === 'filter-modal') filterModal.classList.remove('show');
    });

    return applyLandingSearch();
  }

  function applyLandingSearch() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem('dl_search') || 'null');
    } catch (err) {
      saved = null;
    }
    if (!saved) return false;
    if (saved.country) {
      countrySelect.value = saved.country;
      renderCityField(cityHost, saved.country, saved.city || '');
    }
    if (saved.minAge) ageMinInput.value = saved.minAge;
    if (saved.maxAge) ageMaxInput.value = saved.maxAge;
    localStorage.removeItem('dl_search');
    runSearch();
    return true;
  }

  function init() {
    updateGreeting();
    const landingSearchApplied = initFilterBar();
    if (!landingSearchApplied) load();
  }

  function refresh() {
    if (deck.length === 0) load();
  }

  return { init, refresh, showMatchModal };
})();

window.DiscoverModule = DiscoverModule;
