const ProfileModule = (() => {
  let verificationStatus = 'none';
  let verificationReason = '';
  let pendingDocs = {};

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function renderHeader() {
    const user = State.user;
    const photo = (user.photos && user.photos[user.mainPhotoIndex]) || (user.photos && user.photos[0]) || '/img/default-avatar.svg';
    document.getElementById('profile-avatar').src = photo;
    document.getElementById('profile-name').innerHTML = `${escapeHtml(user.name)} ${user.verified ? verifiedBadgeHTML() : ''}`;
    const topAvatar = document.getElementById('top-bar-avatar');
    if (topAvatar) topAvatar.src = photo;

    const pillHost = document.getElementById('profile-status-pill');
    if (verificationStatus === 'approved') {
      pillHost.innerHTML = `<span class="status-pill approved"><i class="fa-solid fa-check"></i> Compte certifié</span>`;
    } else if (verificationStatus === 'pending') {
      pillHost.innerHTML = `<span class="status-pill pending">Vérification en cours</span>`;
    } else if (verificationStatus === 'rejected') {
      pillHost.innerHTML = `<span class="status-pill rejected">Vérification refusée</span>`;
    } else {
      pillHost.innerHTML = '';
    }
  }

  function renderPhotoGrid() {
    const grid = document.getElementById('photo-grid');
    const photos = State.user.photos || [];
    let html = '';
    photos.forEach((p, i) => {
      html += `
        <div class="photo-slot" data-index="${i}">
          <img src="${p}" />
          ${i === State.user.mainPhotoIndex ? '<span class="main-tag">Principale</span>' : ''}
          <button type="button" class="remove-btn" data-remove="${i}"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    });
    if (photos.length < 6) {
      html += `
        <div class="photo-slot" id="add-photo-slot">
          <span><i class="fa-solid fa-plus"></i></span>
          <input type="file" accept="image/*" id="add-photo-input" />
        </div>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.photo-slot[data-index] img').forEach((img) => {
      img.addEventListener('click', async () => {
        const index = Number(img.closest('.photo-slot').dataset.index);
        try {
          const { user } = await api.put(`/api/profile/photo/${index}/main`);
          State.user = user;
          renderHeader();
          renderPhotoGrid();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
    grid.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = Number(btn.dataset.remove);
        try {
          const { user } = await api.del(`/api/profile/photo/${index}`);
          State.user = user;
          renderHeader();
          renderPhotoGrid();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
    const addInput = document.getElementById('add-photo-input');
    if (addInput) {
      addInput.addEventListener('change', (e) => {
        if (e.target.files[0]) uploadPhoto(e.target.files[0]);
      });
    }
  }

  async function uploadPhoto(fileOrBlob) {
    const fd = new FormData();
    fd.append('photo', fileOrBlob, 'photo.jpg');
    try {
      showToast('Envoi de la photo...');
      const { user } = await api.post('/api/profile/photo', fd, true);
      State.user = user;
      renderHeader();
      renderPhotoGrid();
      showToast('Photo ajoutée');
    } catch (err) {
      showToast(err.message);
    }
  }

  function populateCountrySelect(id) {
    const select = document.getElementById(id);
    if (select.dataset.populated) return;
    COUNTRIES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    select.dataset.populated = '1';
  }

  function fillEditForm() {
    const user = State.user;
    populateCountrySelect('edit-country');
    populateCountrySelect('edit-origin-country');
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-bio').value = user.bio || '';
    document.getElementById('edit-country').value = user.country || '';
    document.getElementById('edit-origin-country').value = user.originCountry || '';
    document.getElementById('edit-seeking').value = user.seeking || 'tous';
    document.getElementById('edit-relationship-status').value = user.relationshipStatus || 'celibataire';
    document.getElementById('edit-age-min').value = user.preferredAgeMin || 18;
    document.getElementById('edit-age-max').value = user.preferredAgeMax || 99;
    document.getElementById('edit-max-distance').value = user.maxDistance || '';
    const locationStatus = document.getElementById('edit-location-status');
    if (locationStatus) {
      locationStatus.innerHTML = user.hasLocation
        ? '<i class="fa-solid fa-location-dot"></i> Position partagée'
        : '<i class="fa-solid fa-location-crosshairs"></i> Position non partagée — sera demandée si vous activez un filtre de distance';
    }

    const cityHost = document.getElementById('edit-city-host');
    renderCityField(cityHost, user.country || '', user.location || '');
    const countrySelect = document.getElementById('edit-country');
    if (!countrySelect.dataset.cityWired) {
      countrySelect.addEventListener('change', () => {
        renderCityField(cityHost, countrySelect.value, '');
      });
      countrySelect.dataset.cityWired = '1';
    }
  }

  async function saveProfile() {
    const cityHost = document.getElementById('edit-city-host');
    const distanceValue = document.getElementById('edit-max-distance').value;
    if (distanceValue) {
      const shared = await requestAndShareLocation();
      if (!shared) {
        document.getElementById('edit-max-distance').value = '';
      }
    }
    const payload = {
      name: document.getElementById('edit-name').value.trim(),
      bio: document.getElementById('edit-bio').value.trim(),
      location: getCityFieldValue(cityHost),
      country: document.getElementById('edit-country').value,
      originCountry: document.getElementById('edit-origin-country').value,
      seeking: document.getElementById('edit-seeking').value,
      relationshipStatus: document.getElementById('edit-relationship-status').value,
      preferredAgeMin: document.getElementById('edit-age-min').value,
      preferredAgeMax: document.getElementById('edit-age-max').value,
      maxDistance: document.getElementById('edit-max-distance').value,
    };
    try {
      const { user } = await api.put('/api/profile', payload);
      State.user = user;
      renderHeader();
      fillEditForm();
      const navName = document.getElementById('app-nav-name');
      if (navName) navName.textContent = user.name;
      showToast('Profil mis à jour');
    } catch (err) {
      showToast(err.message);
    }
  }

  let selectedInterests = [];

  function renderInterests() {
    selectedInterests = (State.user.interests || []).slice();
    const host = document.getElementById('interests-select');
    host.innerHTML = INTERESTS.map(
      (i) => `<button type="button" class="chip ${selectedInterests.includes(i) ? 'selected' : ''}" data-interest="${escapeHtml(i)}">${escapeHtml(i)}</button>`
    ).join('');
    host.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.interest;
        if (selectedInterests.includes(value)) {
          selectedInterests = selectedInterests.filter((i) => i !== value);
        } else {
          if (selectedInterests.length >= 10) {
            showToast('10 centres d\'intérêt maximum');
            return;
          }
          selectedInterests.push(value);
        }
        chip.classList.toggle('selected');
      });
    });
  }

  async function saveInterests() {
    try {
      const { user } = await api.put('/api/profile', { interests: selectedInterests });
      State.user = user;
      showToast('Centres d\'intérêt enregistrés');
    } catch (err) {
      showToast(err.message);
    }
  }

  const DOC_LABELS = {
    idFront: "Pièce d'identité — recto",
    idBack: "Pièce d'identité — verso",
    selfie: 'Photo de vous',
  };

  function renderVerifyCard() {
    const card = document.getElementById('verify-card');

    if (verificationStatus === 'approved') {
      card.innerHTML = `<p style="margin:0;">Votre compte est certifié ${verifiedBadgeHTML()}. Merci d'avoir vérifié votre identité !</p>`;
      return;
    }
    if (verificationStatus === 'pending') {
      card.innerHTML = `<p style="margin:0;">Vos documents sont en cours de vérification par notre équipe. Cela peut prendre jusqu'à 48h.</p>`;
      return;
    }

    pendingDocs = {};
    const rejectBanner =
      verificationStatus === 'rejected'
        ? `<div class="error-msg show">Vérification refusée : ${escapeHtml(verificationReason || 'documents non conformes')}. Vous pouvez renvoyer vos documents.</div>`
        : '';

    card.innerHTML = `
      ${rejectBanner}
      <p style="margin-top:0;color:var(--text-muted);font-size:13px;">Envoyez le recto et le verso de votre pièce d'identité, ainsi qu'une photo de vous, pour obtenir le badge certifié.</p>
      ${['idFront', 'idBack', 'selfie']
        .map(
          (key) => `
        <div class="upload-slot" data-key="${key}">
          <span>${DOC_LABELS[key]}</span>
          <input type="file" accept="image/*" data-file-input="${key}" />
          <button type="button" class="camera-btn" data-camera="${key}"><i class="fa-solid fa-camera"></i> Utiliser la caméra</button>
        </div>`
        )
        .join('')}
      <button type="button" class="btn btn-primary" id="submit-verify-btn">Envoyer pour vérification</button>
    `;

    card.querySelectorAll('[data-file-input]').forEach((input) => {
      input.addEventListener('change', (e) => {
        if (e.target.files[0]) setDoc(input.dataset.fileInput, e.target.files[0]);
      });
    });
    card.querySelectorAll('[data-camera]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Camera.open((blob) => setDoc(btn.dataset.camera, blob));
      });
    });
    document.getElementById('submit-verify-btn').addEventListener('click', submitVerification);
  }

  function setDoc(key, fileOrBlob) {
    pendingDocs[key] = fileOrBlob;
    const slot = document.querySelector(`.upload-slot[data-key="${key}"]`);
    const url = URL.createObjectURL(fileOrBlob);
    let img = slot.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      slot.prepend(img);
    }
    img.src = url;
  }

  async function submitVerification() {
    if (!pendingDocs.idFront || !pendingDocs.idBack || !pendingDocs.selfie) {
      showToast('Merci de fournir les 3 photos demandées');
      return;
    }
    const fd = new FormData();
    fd.append('idFront', pendingDocs.idFront, 'idFront.jpg');
    fd.append('idBack', pendingDocs.idBack, 'idBack.jpg');
    fd.append('selfie', pendingDocs.selfie, 'selfie.jpg');

    const btn = document.getElementById('submit-verify-btn');
    btn.disabled = true;
    btn.textContent = 'Envoi en cours...';
    try {
      const res = await api.post('/api/profile/verify', fd, true);
      verificationStatus = res.verificationStatus;
      renderVerifyCard();
      renderHeader();
      showToast('Documents envoyés, vérification en cours');
    } catch (err) {
      showToast(err.message);
      btn.disabled = false;
      btn.textContent = 'Envoyer pour vérification';
    }
  }

  async function loadVerificationStatus() {
    try {
      const res = await api.get('/api/profile/verification-status');
      verificationStatus = res.verificationStatus;
      verificationReason = res.verificationRejectReason;
      State.user.verified = res.verified;
    } catch (err) {
      console.error(err);
    }
  }

  async function refresh() {
    await loadVerificationStatus();
    renderHeader();
    renderPhotoGrid();
    fillEditForm();
    renderInterests();
    renderVerifyCard();
  }

  function init() {
    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
    document.getElementById('save-interests-btn').addEventListener('click', saveInterests);
    refresh();
  }

  return { init, refresh };
})();

window.ProfileModule = ProfileModule;
