const NotificationsModule = (() => {
  let matchesCache = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 9 ? '9+' : count;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  async function refreshSummary() {
    try {
      const { likesCount, unreadCount, adminMessagesCount } = await api.get('/api/notifications/summary');
      const total = likesCount + unreadCount + adminMessagesCount;
      setBadge('notif-badge-mobile', total);
      setBadge('notif-badge-desktop', total);
      const likesTabCount = document.getElementById('likes-tab-count');
      const messagesTabCount = document.getElementById('messages-tab-count');
      const adminTabCount = document.getElementById('admin-tab-count');
      likesTabCount.textContent = likesCount > 0 ? ` (${likesCount})` : '';
      messagesTabCount.textContent = unreadCount > 0 ? ` (${unreadCount})` : '';
      adminTabCount.textContent = adminMessagesCount > 0 ? ` (${adminMessagesCount})` : '';
    } catch (err) {
      console.error(err);
    }
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function loadAdminPanel() {
    const host = document.getElementById('notif-panel-admin');
    host.innerHTML = '<div class="spinner" style="border-top-color:var(--brand-1);border-color:rgba(133,56,110,0.2);margin:30px auto;"></div>';
    try {
      const { messages } = await api.get('/api/notifications/admin-messages');
      if (messages.length === 0) {
        renderEmpty(host, "Aucun message de l'équipe Dream Love pour le moment.");
      } else {
        host.innerHTML = messages
          .map(
            (m) => `
          <div class="notif-item admin-msg-item ${m.read ? '' : 'unread'}">
            <div class="notif-item-body">
              <div class="match-row-name"><i class="fa-solid fa-bullhorn" style="color:var(--brand-1);margin-right:6px;"></i>Équipe Dream Love</div>
              <p class="admin-msg-text">${escapeHtml(m.message)}</p>
              <div class="match-row-sub">${fmtDate(m.createdAt)}</div>
            </div>
          </div>`
          )
          .join('');
      }
      await api.post('/api/notifications/admin-messages/read');
      refreshSummary();
    } catch (err) {
      renderEmpty(host, err.message);
    }
  }

  function renderEmpty(host, text) {
    host.innerHTML = `<div class="empty-state" style="padding:30px 10px"><div class="icon"><i class="fa-regular fa-envelope"></i></div><p>${escapeHtml(text)}</p></div>`;
  }

  async function loadLikesPanel() {
    const host = document.getElementById('notif-panel-likes');
    host.innerHTML = '<div class="spinner" style="border-top-color:var(--brand-1);border-color:rgba(133,56,110,0.2);margin:30px auto;"></div>';
    try {
      const { users } = await api.get('/api/notifications/likes-received');
      if (users.length === 0) {
        renderEmpty(host, "Personne ne vous a encore liké. Continuez à découvrir des profils !");
        return;
      }
      host.innerHTML = users
        .map((u) => {
          const photo = (u.photos && u.photos[u.mainPhotoIndex]) || (u.photos && u.photos[0]) || '/img/default-avatar.svg';
          return `
          <div class="notif-item" data-view-profile="${u.id}">
            <img class="avatar" src="${photo}" />
            <div class="notif-item-body">
              <div class="match-row-name">${escapeHtml(u.name)}, ${u.age} ${u.verified ? verifiedBadgeHTML() : ''}</div>
              <div class="match-row-sub">${escapeHtml([u.location, u.country].filter(Boolean).join(', '))}</div>
            </div>
            <button type="button" class="btn-icon like" data-like-back="${u.id}" title="Aimer en retour"><i class="fa-solid fa-heart"></i></button>
          </div>`;
        })
        .join('');

      host.querySelectorAll('[data-view-profile]').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-like-back]')) return;
          goToProfile(el.dataset.viewProfile);
        });
      });
      host.querySelectorAll('[data-like-back]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          btn.disabled = true;
          try {
            const res = await api.post(`/api/likes/${btn.dataset.likeBack}`);
            if (res.isMatch && window.DiscoverModule) {
              closeModal();
              window.DiscoverModule.showMatchModal(res.matchedUser, res.conversationId);
            } else {
              loadLikesPanel();
            }
            refreshSummary();
            if (window.MatchesModule) window.MatchesModule.refresh();
          } catch (err) {
            showToast(err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      renderEmpty(host, err.message);
    }
  }

  async function loadMessagesPanel() {
    const host = document.getElementById('notif-panel-messages');
    host.innerHTML = '<div class="spinner" style="border-top-color:var(--brand-1);border-color:rgba(133,56,110,0.2);margin:30px auto;"></div>';
    try {
      const { matches } = await api.get('/api/matches');
      matchesCache = matches;
      const unread = matches.filter((m) => m.unreadCount > 0);
      if (unread.length === 0) {
        renderEmpty(host, 'Aucun nouveau message pour le moment.');
        return;
      }
      host.innerHTML = unread
        .map((m) => {
          const photo = (m.user.photos && m.user.photos[m.user.mainPhotoIndex]) || (m.user.photos && m.user.photos[0]) || '/img/default-avatar.svg';
          return `
          <div class="notif-item" data-open-conv="${m.user.id}">
            <img class="avatar" src="${photo}" />
            <div class="notif-item-body">
              <div class="match-row-name">${escapeHtml(m.user.name)} ${m.user.verified ? verifiedBadgeHTML() : ''}</div>
              <div class="match-row-sub">${escapeHtml(m.lastMessage || '')}</div>
            </div>
            <span class="unread-dot">${m.unreadCount}</span>
          </div>`;
        })
        .join('');

      host.querySelectorAll('[data-open-conv]').forEach((el) => {
        el.addEventListener('click', () => {
          const match = matchesCache.find((m) => m.user.id === el.dataset.openConv);
          if (!match) return;
          closeModal();
          switchView('messages');
          if (window.ChatModule) window.ChatModule.open(match.conversationId, match.user);
        });
      });
    } catch (err) {
      renderEmpty(host, err.message);
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.notif-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('notif-panel-likes').style.display = tab === 'likes' ? 'block' : 'none';
    document.getElementById('notif-panel-messages').style.display = tab === 'messages' ? 'block' : 'none';
    document.getElementById('notif-panel-admin').style.display = tab === 'admin' ? 'block' : 'none';
    if (tab === 'likes') loadLikesPanel();
    else if (tab === 'messages') loadMessagesPanel();
    else loadAdminPanel();
  }

  function openModal() {
    document.getElementById('notif-modal').classList.add('show');
    switchTab('likes');
  }

  function closeModal() {
    document.getElementById('notif-modal').classList.remove('show');
  }

  function init() {
    ['notif-bell-btn-mobile', 'notif-bell-btn-desktop'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', openModal);
    });
    document.getElementById('notif-modal-close').addEventListener('click', closeModal);
    document.getElementById('notif-modal').addEventListener('click', (e) => {
      if (e.target.id === 'notif-modal') closeModal();
    });
    document.querySelectorAll('.notif-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    refreshSummary();
  }

  return { init, refreshSummary };
})();

window.NotificationsModule = NotificationsModule;
