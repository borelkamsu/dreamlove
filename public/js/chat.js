const ChatModule = (() => {
  let conversationId = null;
  let otherUser = null;
  let typingHideTimer = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderHeader() {
    if (!otherUser) return;
    document.getElementById('chat-avatar').src =
      (otherUser.photos && otherUser.photos[0]) || '/img/default-avatar.svg';
    document.getElementById('chat-name').innerHTML = `${escapeHtml(otherUser.name)} ${
      otherUser.verified ? verifiedBadgeHTML() : ''
    }`;
    const presence = State.presence.get(String(otherUser.id));
    const online = presence ? presence.online : otherUser.online;
    const lastSeen = presence ? presence.lastSeen : otherUser.lastSeen;
    document.getElementById('chat-presence').classList.toggle('online', !!online);
    document.getElementById('chat-status').textContent = online ? 'En ligne' : formatLastSeenClient(lastSeen);
  }

  function appendBubble(msg) {
    const body = document.getElementById('chat-body');
    const isMine = String(msg.sender) === String(State.user.id);
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${isMine ? 'mine' : 'theirs'}`;
    bubble.innerHTML = `${escapeHtml(msg.text)}<div class="msg-time">${formatTime(msg.createdAt)}</div>`;
    body.appendChild(bubble);
    body.scrollTop = body.scrollHeight;
  }

  function clearTyping() {
    const el = document.getElementById('typing-el');
    if (el) el.remove();
  }

  function showTyping() {
    clearTyping();
    const body = document.getElementById('chat-body');
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing-el';
    el.textContent = 'est en train d\'écrire...';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  async function open(convId, user) {
    conversationId = convId;
    otherUser = user;
    renderHeader();

    document.getElementById('messages-layout').classList.add('chat-open');
    document.getElementById('app-root').classList.add('chat-fullscreen');
    document.getElementById('chat-empty-state').style.display = 'none';
    document.getElementById('chat-content').style.display = 'flex';

    const body = document.getElementById('chat-body');
    body.innerHTML = '';

    if (!conversationId) {
      body.innerHTML = `<div class="empty-state"><p>Envoyez le premier message !</p></div>`;
      return;
    }

    try {
      const { messages } = await api.get(`/api/conversations/${conversationId}/messages`);
      body.innerHTML = '';
      messages.forEach(appendBubble);
      body.scrollTop = body.scrollHeight;
      if (window.NotificationsModule) window.NotificationsModule.refreshSummary();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    return null;
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      let convId = await ensureConversation();
      if (!convId) {
        showToast('Impossible d\'envoyer : conversation introuvable');
        return;
      }
      await api.post(`/api/conversations/${convId}/messages`, { text });
    } catch (err) {
      showToast(err.message);
    }
  }

  function onIncomingMessage(msg) {
    if (msg.conversationId !== conversationId) return;
    clearTyping();
    appendBubble(msg);
  }

  function onPresenceUpdate(userId, online, lastSeen) {
    if (otherUser && String(userId) === String(otherUser.id)) {
      otherUser.online = online;
      otherUser.lastSeen = lastSeen;
      renderHeader();
    }
  }

  function onTyping(convId, fromUserId) {
    if (convId !== conversationId) return;
    if (!otherUser || String(fromUserId) !== String(otherUser.id)) return;
    showTyping();
    clearTimeout(typingHideTimer);
    typingHideTimer = setTimeout(clearTyping, 3000);
  }

  function currentConversationId() {
    return conversationId;
  }

  function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    const toggleBtn = document.getElementById('emoji-toggle-btn');
    const input = document.getElementById('chat-input');

    picker.innerHTML = EMOJI_LIST.map((e) => `<button type="button" class="emoji-option">${e}</button>`).join('');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.classList.toggle('show');
    });
    picker.querySelectorAll('.emoji-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + btn.textContent + input.value.slice(end);
        const cursor = start + btn.textContent.length;
        input.focus();
        input.setSelectionRange(cursor, cursor);
      });
    });
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== toggleBtn) {
        picker.classList.remove('show');
      }
    });
  }

  function init() {
    document.getElementById('chat-back').addEventListener('click', () => {
      document.getElementById('messages-layout').classList.remove('chat-open');
      document.getElementById('app-root').classList.remove('chat-fullscreen');
    });
    document.getElementById('chat-header-info').addEventListener('click', () => {
      if (otherUser) goToProfile(otherUser.id);
    });
    document.getElementById('chat-send').addEventListener('click', send);
    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    input.addEventListener('input', () => {
      if (conversationId && otherUser && State.socket) {
        State.socket.emit('typing', { conversationId, toUserId: otherUser.id });
      }
    });
    initEmojiPicker();
  }

  return { init, open, onIncomingMessage, onPresenceUpdate, onTyping, currentConversationId };
})();

window.ChatModule = ChatModule;

document.addEventListener('DOMContentLoaded', () => ChatModule.init());
