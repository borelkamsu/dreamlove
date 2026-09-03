const State = {
  user: null,
  socket: null,
  presence: new Map(),
};

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  const view = document.getElementById(`view-${name}`);
  if (view) view.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('app-root').classList.remove('chat-fullscreen');
  const layout = document.getElementById('messages-layout');
  if (layout) layout.classList.remove('chat-open');
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { user } = await api.get('/api/auth/me');
    State.user = user;
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('page-loader').style.display = 'none';
  document.getElementById('app-root').style.display = 'block';

  const navAvatar = document.getElementById('top-bar-avatar');
  navAvatar.src = (State.user.photos && State.user.photos[0]) || '/img/default-avatar.svg';
  document.getElementById('app-nav-name').textContent = State.user.name;
  document.getElementById('app-nav-user').addEventListener('click', () => {
    switchView('profile');
    if (window.ProfileModule) window.ProfileModule.refresh();
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      if (view === 'discover' && window.DiscoverModule) window.DiscoverModule.refresh();
      if (view === 'messages' && window.MatchesModule) window.MatchesModule.refresh();
      if (view === 'profile' && window.ProfileModule) window.ProfileModule.refresh();
    });
  });

  ['app-home-btn-desktop', 'app-home-btn-mobile'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        switchView('discover');
        if (window.DiscoverModule) window.DiscoverModule.refresh();
      });
    }
  });

  const socket = io({ withCredentials: true });
  State.socket = socket;

  socket.on('presence:update', ({ userId, online, lastSeen }) => {
    State.presence.set(String(userId), { online, lastSeen });
    if (window.MatchesModule) window.MatchesModule.onPresenceUpdate(userId, online, lastSeen);
    if (window.ChatModule) window.ChatModule.onPresenceUpdate(userId, online, lastSeen);
  });

  socket.on('message:new', (msg) => {
    if (window.ChatModule) window.ChatModule.onIncomingMessage(msg);
    if (window.MatchesModule) window.MatchesModule.onIncomingMessage(msg);
    if (window.NotificationsModule) window.NotificationsModule.refreshSummary();
  });

  socket.on('match:new', ({ user, conversationId }) => {
    if (window.DiscoverModule) window.DiscoverModule.showMatchModal(user, conversationId);
    if (window.MatchesModule) window.MatchesModule.refresh();
    if (window.NotificationsModule) window.NotificationsModule.refreshSummary();
  });

  socket.on('like:received', () => {
    if (window.NotificationsModule) window.NotificationsModule.refreshSummary();
  });

  socket.on('typing', ({ conversationId, fromUserId }) => {
    if (window.ChatModule) window.ChatModule.onTyping(conversationId, fromUserId);
  });

  if (window.DiscoverModule) window.DiscoverModule.init();
  if (window.MatchesModule) window.MatchesModule.init();
  if (window.ProfileModule) window.ProfileModule.init();
  if (window.NotificationsModule) window.NotificationsModule.init();
});

async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (e) {
    /* ignore */
  }
  window.location.href = '/index.html';
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#logout-btn')) logout();
});
