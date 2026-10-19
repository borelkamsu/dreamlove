const adminApi = {
  async request(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Erreur');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },
};

// Logged-in staff member: { username, role } where role is 'admin' or 'editor'
let adminSession = { username: '', role: 'editor' };

function isFullAdmin() {
  return adminSession.role === 'admin';
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrateur' : 'Éditeur';
}

function applyRole() {
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.style.display = isFullAdmin() ? '' : 'none';
  });
  document.getElementById('admin-identity').innerHTML =
    `<strong>${escapeHtml(adminSession.username)}</strong>${roleLabel(adminSession.role)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status) {
  return { none: 'Non certifié', pending: 'En attente', approved: 'Certifié', rejected: 'Refusé' }[status] || status;
}

let usersState = { page: 1, search: '', status: '' };

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('show');
}
document.getElementById('lightbox').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('show');
});

function showAdminToast(message) {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-bell"></i><span>${escapeHtml(message)}</span>`;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4500);
}

function updateBellBadge(count) {
  ['admin-bell-badge-mobile', 'admin-bell-badge-desktop'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 9 ? '9+' : count;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

async function loadStats() {
  const stats = await adminApi.get('/api/admin/stats');
  const cards = [
    { label: 'Utilisateurs', num: stats.totalUsers },
    { label: 'Comptes certifiés', num: stats.verifiedUsers },
    { label: 'Vérifications en attente', num: stats.pendingVerifications },
    { label: 'Matchs', num: stats.totalMatches },
    { label: 'Messages échangés', num: stats.totalMessages },
    { label: 'En ligne actuellement', num: stats.onlineNow },
  ];
  document.getElementById('stat-cards').innerHTML = cards
    .map((c) => `<div class="stat-card"><div class="num">${c.num}</div><div class="label">${c.label}</div></div>`)
    .join('');

  updateBellBadge(stats.pendingVerifications);

  const verifHost = document.getElementById('verif-stat-cards');
  if (verifHost) {
    const verifCards = [
      { label: 'En attente', num: stats.pendingVerifications },
      { label: 'Certifiés', num: stats.verifiedUsers },
      { label: 'Refusés', num: stats.rejectedVerifications },
    ];
    verifHost.innerHTML = verifCards
      .map((c) => `<div class="stat-card"><div class="num">${c.num}</div><div class="label">${c.label}</div></div>`)
      .join('');
  }
}

async function loadUsers() {
  const params = new URLSearchParams({
    page: usersState.page,
    search: usersState.search,
    status: usersState.status,
  });
  const { users, pages, page } = await adminApi.get(`/api/admin/users?${params.toString()}`);
  const tbody = document.getElementById('users-tbody');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-note">Aucun utilisateur trouvé</div></td></tr>`;
  } else {
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr data-id="${u.id}">
        <td class="cell-user">
          <div class="user-cell">
            <img src="${u.photo || '/icons/icon-192.png'}" />
            <span>${escapeHtml(u.name)} ${u.verified ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}</span>
          </div>
        </td>
        <td data-label="Email">${escapeHtml(u.email)}</td>
        <td data-label="Statut"><span class="badge-pill ${u.verificationStatus}">${statusLabel(u.verificationStatus)}</span></td>
        <td data-label="Présence"><span class="badge-pill ${u.online ? 'online' : 'offline'}">${u.online ? 'En ligne' : 'Hors ligne'}</span></td>
        <td data-label="Inscrit le">${fmtDate(u.createdAt)}</td>
        <td class="actions-cell">
          ${u.verificationStatus === 'approved'
            ? `<button class="btn btn-sm btn-outline" data-unverify="${u.id}">Retirer certification</button>`
            : `<button class="btn btn-sm btn-success" data-verify="${u.id}">Certifier</button>`}
          ${u.isBanned
            ? `<button class="btn btn-sm btn-outline" data-unban="${u.id}">Réactiver</button>`
            : `<button class="btn btn-sm btn-danger" data-ban="${u.id}">Bannir</button>`}
          <button class="btn btn-sm btn-outline" data-message="${u.id}"><i class="fa-solid fa-message"></i> Message</button>
        </td>
      </tr>`
      )
      .join('');
  }

  const pag = document.getElementById('users-pagination');
  pag.innerHTML = '';
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === page) btn.classList.add('active');
    btn.addEventListener('click', () => {
      usersState.page = i;
      loadUsers();
    });
    pag.appendChild(btn);
  }

  tbody.querySelectorAll('[data-verify]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await adminApi.post(`/api/admin/users/${btn.dataset.verify}/verify`);
      loadUsers();
      loadStats();
    })
  );
  tbody.querySelectorAll('[data-unverify]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Retirer la certification de cet utilisateur ?')) return;
      await adminApi.post(`/api/admin/users/${btn.dataset.unverify}/unverify`);
      loadUsers();
      loadStats();
    })
  );
  tbody.querySelectorAll('[data-ban]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Bannir cet utilisateur ?')) return;
      await adminApi.post(`/api/admin/users/${btn.dataset.ban}/ban`);
      loadUsers();
    })
  );
  tbody.querySelectorAll('[data-unban]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await adminApi.post(`/api/admin/users/${btn.dataset.unban}/unban`);
      loadUsers();
    })
  );
  tbody.querySelectorAll('[data-message]').forEach((btn) =>
    btn.addEventListener('click', () => sendAdminMessage(btn.dataset.message))
  );
}

async function sendAdminMessage(userId, defaultText) {
  const message = prompt('Message à envoyer à cet utilisateur :', defaultText || '');
  if (message === null) return;
  const trimmed = message.trim();
  if (!trimmed) return;
  try {
    await adminApi.post(`/api/admin/users/${userId}/message`, { message: trimmed });
    alert('Message envoyé.');
  } catch (err) {
    alert(err.message);
  }
}

function renderVerifCard(req) {
  const div = document.createElement('div');
  div.className = 'verif-card';
  div.innerHTML = `
    <div class="head">
      <div><strong>${escapeHtml(req.name)}</strong><br/><span style="color:var(--text-muted);font-size:12px">${escapeHtml(req.email)}</span></div>
      <span style="color:var(--text-muted);font-size:12px">${fmtDate(req.submittedAt)}</span>
    </div>
    <div class="verif-images">
      <img src="${req.docs.idFront?.url}" data-full="${req.docs.idFront?.url}" alt="Recto" />
      <img src="${req.docs.idBack?.url}" data-full="${req.docs.idBack?.url}" alt="Verso" />
      <img src="${req.docs.selfie?.url}" data-full="${req.docs.selfie?.url}" alt="Selfie" />
    </div>
    <div class="verif-actions">
      <button class="btn btn-sm btn-success" data-approve="${req.id}"><i class="fa-solid fa-check"></i> Approuver</button>
      <button class="btn btn-sm btn-danger" data-reject="${req.id}"><i class="fa-solid fa-xmark"></i> Rejeter</button>
      ${isFullAdmin() ? `<button class="btn btn-sm btn-outline" data-message="${req.id}"><i class="fa-solid fa-message"></i> Demander des pièces / Message</button>` : ''}
    </div>
  `;
  div.querySelectorAll('img[data-full]').forEach((img) => {
    img.addEventListener('click', () => openLightbox(img.dataset.full));
  });
  const messageBtn = div.querySelector('[data-message]');
  if (messageBtn) {
    messageBtn.addEventListener('click', () => {
      sendAdminMessage(req.id, 'Merci de renvoyer une photo plus nette de votre pièce d\'identité et de votre selfie.');
    });
  }
  div.querySelector('[data-approve]').addEventListener('click', async () => {
    await adminApi.post(`/api/admin/users/${req.id}/verify`);
    loadVerifications();
    loadStats();
    loadOverviewPending();
  });
  div.querySelector('[data-reject]').addEventListener('click', async () => {
    const reason = prompt('Raison du refus (visible par l\'utilisateur) :', 'Documents illisibles ou non conformes');
    if (reason === null) return;
    await adminApi.post(`/api/admin/users/${req.id}/reject`, { reason });
    loadVerifications();
    loadStats();
    loadOverviewPending();
  });
  return div;
}

async function loadVerifications() {
  const { requests } = await adminApi.get('/api/admin/verifications');
  const host = document.getElementById('verifications-list');
  host.innerHTML = '';
  if (requests.length === 0) {
    host.innerHTML = `<div class="panel"><div class="empty-note">Aucune demande en attente</div></div>`;
    return;
  }
  requests.forEach((req) => host.appendChild(renderVerifCard(req)));
}

async function loadOverviewPending() {
  const { requests } = await adminApi.get('/api/admin/verifications');
  const host = document.getElementById('overview-pending-list');
  host.innerHTML = '';
  if (requests.length === 0) {
    host.innerHTML = `<div class="empty-note">Aucune demande en attente</div>`;
    return;
  }
  requests.slice(0, 3).forEach((req) => host.appendChild(renderVerifCard(req)));
}

let matchesState = { page: 1 };

async function loadMatches() {
  const params = new URLSearchParams({ page: matchesState.page });
  const { matches, pages, page, total } = await adminApi.get(`/api/admin/matches?${params.toString()}`);
  document.getElementById('matches-total-count').textContent = total;
  const host = document.getElementById('matches-list');
  if (matches.length === 0) {
    host.innerHTML = `<div class="empty-note">Aucun match pour le moment</div>`;
  } else {
    host.innerHTML = matches
      .map((m) => {
        const [a, b] = m.users;
        const userHtml = (u) =>
          u
            ? `<div class="match-user"><img src="${u.photo || '/icons/icon-192.png'}" /><span>${escapeHtml(u.name)} ${u.verified ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}</span></div>`
            : `<div class="match-user"><span style="color:var(--text-muted)">Utilisateur supprimé</span></div>`;
        return `
      <div class="match-card">
        <div class="match-users">
          ${userHtml(a)}
          <i class="fa-solid fa-heart match-heart"></i>
          ${userHtml(b)}
        </div>
        <div class="match-date">${fmtDate(m.createdAt)}</div>
      </div>`;
      })
      .join('');
  }

  const pag = document.getElementById('matches-pagination');
  pag.innerHTML = '';
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === page) btn.classList.add('active');
    btn.addEventListener('click', () => {
      matchesState.page = i;
      loadMatches();
    });
    pag.appendChild(btn);
  }
}

async function loadTeam() {
  const { admins, me, mainAccount } = await adminApi.get('/api/admin/team');
  const tbody = document.getElementById('team-tbody');
  const rows = [];
  if (mainAccount) {
    rows.push(`
      <tr>
        <td><strong>${escapeHtml(mainAccount)}</strong> <span style="color:var(--text-muted);font-size:12px">(compte principal)</span></td>
        <td><span class="badge-pill role-admin">Administrateur</span></td>
        <td>—</td>
        <td>—</td>
        <td><span style="color:var(--text-muted);font-size:12px">Défini dans la configuration du serveur</span></td>
      </tr>`);
  }
  admins.forEach((a) => {
    const isMe = String(a.id) === String(me.id);
    rows.push(`
      <tr>
        <td><strong>${escapeHtml(a.username)}</strong>${isMe ? ' <span style="color:var(--text-muted);font-size:12px">(vous)</span>' : ''}</td>
        <td>
          <select class="team-row-select" data-role-select="${a.id}" ${isMe ? 'disabled' : ''}>
            <option value="editor" ${a.role === 'editor' ? 'selected' : ''}>Éditeur</option>
            <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Administrateur</option>
          </select>
        </td>
        <td>${escapeHtml(a.createdBy || '—')}</td>
        <td>${a.lastLoginAt ? fmtDate(a.lastLoginAt) : 'Jamais'}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline" data-reset-password="${a.id}"><i class="fa-solid fa-key"></i> Mot de passe</button>
          ${isMe ? '' : `<button class="btn btn-sm btn-danger" data-delete-admin="${a.id}"><i class="fa-solid fa-trash"></i> Supprimer</button>`}
        </td>
      </tr>`);
  });
  tbody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="5"><div class="empty-note">Aucun compte</div></td></tr>';

  tbody.querySelectorAll('[data-role-select]').forEach((select) =>
    select.addEventListener('change', async () => {
      try {
        await adminApi.put(`/api/admin/team/${select.dataset.roleSelect}`, { role: select.value });
        showAdminToast(`Rôle mis à jour : ${roleLabel(select.value)}`);
      } catch (err) {
        alert(err.message);
      }
      loadTeam();
    })
  );
  tbody.querySelectorAll('[data-reset-password]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const password = prompt('Nouveau mot de passe (8 caractères minimum) :');
      if (!password) return;
      try {
        await adminApi.put(`/api/admin/team/${btn.dataset.resetPassword}`, { password });
        showAdminToast('Mot de passe modifié');
      } catch (err) {
        alert(err.message);
      }
    })
  );
  tbody.querySelectorAll('[data-delete-admin]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ce compte ? La personne sera déconnectée immédiatement.')) return;
      try {
        await adminApi.del(`/api/admin/team/${btn.dataset.deleteAdmin}`);
        showAdminToast('Compte supprimé');
      } catch (err) {
        alert(err.message);
      }
      loadTeam();
    })
  );
}

async function createTeamMember(e) {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById('team-error');
  const submitBtn = document.getElementById('team-create-btn');
  errorBox.classList.remove('show');
  submitBtn.disabled = true;
  const fd = new FormData(form);
  try {
    const { admin } = await adminApi.post('/api/admin/team', {
      username: fd.get('username'),
      password: fd.get('password'),
      role: fd.get('role'),
    });
    form.reset();
    showAdminToast(`Compte « ${admin.username} » créé (${roleLabel(admin.role)})`);
    loadTeam();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  } finally {
    submitBtn.disabled = false;
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('show');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach((p) => (p.style.display = 'none'));
  document.querySelectorAll('.sidebar .nav-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'users') loadUsers();
  if (tab === 'verifications') { loadVerifications(); loadStats(); }
  if (tab === 'matches') loadMatches();
  if (tab === 'overview') { loadStats(); loadOverviewPending(); }
  if (tab === 'team') loadTeam();
  closeSidebar();
}

function initDashboard() {
  document.querySelectorAll('.sidebar .nav-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  const homeBtn = document.getElementById('admin-home-btn');
  if (homeBtn) homeBtn.addEventListener('click', () => switchTab(isFullAdmin() ? 'overview' : 'verifications'));
  document.getElementById('team-create-form').addEventListener('submit', createTeamMember);
  applyRole();
  const menuToggle = document.getElementById('admin-menu-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
  ['admin-bell-btn-mobile', 'admin-bell-btn-desktop'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => switchTab('verifications'));
  });
  initAdminSocket();
  document.getElementById('admin-logout').addEventListener('click', async () => {
    await adminApi.post('/api/admin/logout');
    window.location.reload();
  });
  document.getElementById('user-search').addEventListener('input', debounce(() => {
    usersState.search = document.getElementById('user-search').value;
    usersState.page = 1;
    loadUsers();
  }, 350));
  document.getElementById('status-filter').addEventListener('change', () => {
    usersState.status = document.getElementById('status-filter').value;
    usersState.page = 1;
    loadUsers();
  });

  // Editors only work on certification requests
  switchTab(isFullAdmin() ? 'overview' : 'verifications');
}

let adminSocket = null;

function initAdminSocket() {
  if (adminSocket) return;
  adminSocket = io({ withCredentials: true });
  adminSocket.on('admin:new-verification', (data) => {
    showAdminToast(`Nouvelle demande de certification : ${data.name}`);
    loadStats();
    const verifTabVisible = document.getElementById('tab-verifications').style.display !== 'none';
    const overviewTabVisible = document.getElementById('tab-overview').style.display !== 'none';
    if (verifTabVisible) loadVerifications();
    if (overviewTabVisible) loadOverviewPending();
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('login-error');
  errorMsg.classList.remove('show');
  const submitBtn = document.getElementById('login-submit');
  submitBtn.disabled = true;
  const fd = new FormData(e.target);
  try {
    const { role, username } = await adminApi.post('/api/admin/login', {
      username: fd.get('username'),
      password: fd.get('password'),
    });
    adminSession = { role, username };
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    initDashboard();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.classList.add('show');
  } finally {
    submitBtn.disabled = false;
  }
});

(async function bootstrap() {
  try {
    const { isAdmin, role, username } = await adminApi.get('/api/admin/session');
    if (isAdmin) {
      adminSession = { role, username };
      document.getElementById('login-view').style.display = 'none';
      document.getElementById('dashboard-view').style.display = 'flex';
      initDashboard();
    }
  } catch (err) {
    console.error(err);
  }
})();
