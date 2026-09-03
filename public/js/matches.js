const MatchesModule = (() => {
  let matches = [];

  function updateUnreadBadge() {
    const total = matches.reduce((sum, m) => sum + (m.unreadCount || 0), 0);
    const badge = document.getElementById('unread-badge');
    if (total > 0) {
      badge.textContent = total > 9 ? '9+' : total;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function render() {
    const list = document.getElementById('matches-list');
    if (matches.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon"><i class="fa-solid fa-comments"></i></div>
          <p>Pas encore de match.<br/>Continuez à découvrir des profils !</p>
        </div>`;
      updateUnreadBadge();
      return;
    }
    list.innerHTML = matches
      .map((m) => {
        const photo = m.user.photos[m.user.mainPhotoIndex] || m.user.photos[0] || '/img/default-avatar.svg';
        const sub = m.lastMessage ? escapeHtml(m.lastMessage) : 'Dites bonjour !';
        return `
        <div class="match-row" data-id="${m.user.id}" data-conv="${m.conversationId || ''}">
          <div class="avatar-wrap" data-view-profile="${m.user.id}">
            <img class="avatar" src="${photo}" />
            <span class="presence-dot ${m.user.online ? 'online' : ''}" data-presence="${m.user.id}"></span>
          </div>
          <div class="match-row-body">
            <div class="match-row-name">${escapeHtml(m.user.name)} ${m.user.verified ? verifiedBadgeHTML() : ''}</div>
            <div class="match-row-sub">${sub}</div>
          </div>
          ${m.unreadCount > 0 ? `<span class="unread-dot">${m.unreadCount}</span>` : ''}
        </div>`;
      })
      .join('');

    list.querySelectorAll('.match-row').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const match = matches.find((m) => m.user.id === id);
        if (!match) return;
        openChatForMatch(match);
      });
    });
    list.querySelectorAll('[data-view-profile]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        goToProfile(el.dataset.viewProfile);
      });
    });
    updateUnreadBadge();
  }

  async function openChatForMatch(match) {
    let conversationId = match.conversationId;
    match.unreadCount = 0;
    render();
    if (window.ChatModule) {
      await window.ChatModule.open(conversationId, match.user);
    }
  }

  async function refresh() {
    try {
      const { matches: data } = await api.get('/api/matches');
      matches = data;
      render();
    } catch (err) {
      console.error(err);
    }
  }

  function onPresenceUpdate(userId, online, lastSeen) {
    const match = matches.find((m) => m.user.id === String(userId));
    if (match) {
      match.user.online = online;
      match.user.lastSeen = lastSeen;
      render();
    }
  }

  function onIncomingMessage(msg) {
    const match = matches.find((m) => m.conversationId === msg.conversationId);
    if (match) {
      match.lastMessage = msg.text;
      match.lastMessageAt = msg.createdAt;
      const messagesActive = document.getElementById('view-messages').classList.contains('active');
      const layout = document.getElementById('messages-layout');
      const chatOpen =
        messagesActive &&
        layout &&
        layout.classList.contains('chat-open') &&
        window.ChatModule &&
        window.ChatModule.currentConversationId() === msg.conversationId;
      if (String(msg.sender) !== String(State.user.id) && !chatOpen) {
        match.unreadCount = (match.unreadCount || 0) + 1;
      }
      matches.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      render();
    } else {
      refresh();
    }
  }

  function init() {
    refresh();
  }

  return { init, refresh, onPresenceUpdate, onIncomingMessage };
})();

window.MatchesModule = MatchesModule;
