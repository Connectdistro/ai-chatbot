(function () {
  // ── Config ──
  const script = document.currentScript;
  const API_URL = script?.getAttribute('data-api') || 'http://localhost:3000';
  const BOT_NAME = script?.getAttribute('data-bot-name') || 'AI Assistant';
  const PRIMARY = script?.getAttribute('data-color') || '#3B82F6';
  const TENANT_ID = script?.getAttribute('data-tenant') || null;

  // ── Session ──
  let sessionId = null;

  // ── Inject CSS ──
  const style = document.createElement('style');
  style.textContent = `
    #cb-wrapper * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }
    #cb-bubble {
      position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
      background: ${PRIMARY}; border-radius: 50%; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2); display: flex;
      align-items: center; justify-content: center;
      z-index: 99999; transition: transform 0.2s;
    }
    #cb-bubble:hover { transform: scale(1.1); }
    #cb-bubble svg { width: 26px; height: 26px; fill: white; }
    #cb-panel {
      position: fixed; bottom: 92px; right: 24px;
      width: 360px; height: 520px; background: #fff;
      border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: none; flex-direction: column; z-index: 99998;
      overflow: hidden; animation: cb-slide-up 0.25s ease;
    }
    @keyframes cb-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #cb-panel.open { display: flex; }
    #cb-header {
      background: ${PRIMARY}; color: white; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #cb-header-left { display: flex; align-items: center; gap: 10px; }
    #cb-avatar {
      width: 34px; height: 34px; background: rgba(255,255,255,0.25);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    #cb-title { font-size: 15px; font-weight: 600; }
    #cb-subtitle { font-size: 11px; opacity: 0.8; }
    #cb-close {
      background: none; border: none; color: white; cursor: pointer;
      font-size: 20px; line-height: 1; opacity: 0.8; padding: 4px;
    }
    #cb-close:hover { opacity: 1; }
    #cb-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      background: #F8FAFC;
    }
    #cb-messages::-webkit-scrollbar { width: 4px; }
    #cb-messages::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
    .cb-msg { display: flex; flex-direction: column; max-width: 82%; }
    .cb-msg.user { align-self: flex-end; align-items: flex-end; }
    .cb-msg.bot  { align-self: flex-start; align-items: flex-start; }
    .cb-bubble-text {
      padding: 10px 14px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.5; word-break: break-word;
    }
    .cb-msg.user .cb-bubble-text { background: ${PRIMARY}; color: white; border-bottom-right-radius: 4px; }
    .cb-msg.bot  .cb-bubble-text { background: white; color: #1E293B; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .cb-time { font-size: 10px; color: #94A3B8; margin-top: 3px; padding: 0 4px; }
    #cb-typing { display: none; align-self: flex-start; }
    #cb-typing.active { display: flex; }
    .cb-typing-dots {
      background: white; border-radius: 14px; border-bottom-left-radius: 4px;
      padding: 12px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      display: flex; gap: 4px; align-items: center;
    }
    .cb-dot {
      width: 7px; height: 7px; background: #94A3B8;
      border-radius: 50%; animation: cb-bounce 1.2s infinite;
    }
    .cb-dot:nth-child(2) { animation-delay: 0.2s; }
    .cb-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes cb-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }
    #cb-footer { padding: 12px; background: white; border-top: 1px solid #E2E8F0; }
    #cb-input-row { display: flex; gap: 8px; align-items: center; }
    #cb-input {
      flex: 1; border: 1.5px solid #E2E8F0; border-radius: 24px;
      padding: 10px 16px; font-size: 13.5px; outline: none;
      transition: border-color 0.2s; resize: none;
      background: #F8FAFC; color: #1E293B;
    }
    #cb-input:focus { border-color: ${PRIMARY}; background: white; }
    #cb-send {
      width: 38px; height: 38px; background: ${PRIMARY};
      border: none; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s; flex-shrink: 0;
    }
    #cb-send:hover { opacity: 0.85; }
    #cb-send svg { width: 16px; height: 16px; fill: white; }
    #cb-powered { text-align: center; font-size: 10px; color: #CBD5E1; margin-top: 6px; }
    .cb-rating { display: flex; gap: 6px; justify-content: flex-start; margin-top: 4px; padding-left: 4px; }
    .cb-rate-btn {
      background: none; border: 1px solid #E2E8F0; border-radius: 20px;
      padding: 2px 8px; font-size: 11px; cursor: pointer; color: #94A3B8;
      transition: all 0.2s;
    }
    .cb-rate-btn:hover { border-color: ${PRIMARY}; color: ${PRIMARY}; }
    .cb-rate-btn.selected { background: ${PRIMARY}; color: white; border-color: ${PRIMARY}; }
  `;
  document.head.appendChild(style);

  // ── Build HTML ──
  const wrapper = document.createElement('div');
  wrapper.id = 'cb-wrapper';
  wrapper.innerHTML = `
    <div id="cb-bubble">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </div>
    <div id="cb-panel">
      <div id="cb-header">
        <div id="cb-header-left">
          <div id="cb-avatar">🤖</div>
          <div>
            <div id="cb-title">${BOT_NAME}</div>
            <div id="cb-subtitle">Online • Ready to help</div>
          </div>
        </div>
        <button id="cb-close">✕</button>
      </div>
      <div id="cb-messages">
        <div class="cb-msg bot">
          <div class="cb-bubble-text">Hi there! 👋 I'm ${BOT_NAME}. How can I help you today?</div>
          <div class="cb-time">Just now</div>
        </div>
        <div id="cb-typing">
          <div class="cb-typing-dots">
            <div class="cb-dot"></div>
            <div class="cb-dot"></div>
            <div class="cb-dot"></div>
          </div>
        </div>
      </div>
      <div id="cb-footer">
        <div id="cb-input-row">
          <input id="cb-input" type="text" placeholder="Type a message..." />
          <button id="cb-send">
            <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>
        <div id="cb-powered">Powered by Nebula AI</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ── Logic ──
  const bubble = document.getElementById('cb-bubble');
  const panel = document.getElementById('cb-panel');
  const closeBtn = document.getElementById('cb-close');
  const messages = document.getElementById('cb-messages');
  const input = document.getElementById('cb-input');
  const sendBtn = document.getElementById('cb-send');
  const typing = document.getElementById('cb-typing');

  bubble.addEventListener('click', () => panel.classList.toggle('open'));
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addMessage(text, role, showRating = false) {
    typing.remove();
    const div = document.createElement('div');
    div.className = `cb-msg ${role}`;

    let ratingHTML = '';
    if (showRating && role === 'bot') {
      ratingHTML = `
        <div class="cb-rating">
          <button class="cb-rate-btn" onclick="rateResponse(this, 5)">👍</button>
          <button class="cb-rate-btn" onclick="rateResponse(this, 1)">👎</button>
        </div>`;
    }

    div.innerHTML = `
      <div class="cb-bubble-text">${text.replace(/\n/g, '<br>')}</div>
      <div class="cb-time">${getTime()}</div>
      ${ratingHTML}
    `;
    messages.appendChild(div);
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Rating ──
  window.rateResponse = async function(btn, rating) {
    const siblings = btn.parentElement.querySelectorAll('.cb-rate-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    if (!TENANT_ID || !sessionId) return;
    try {
      await fetch(`${API_URL}/api/chat/${TENANT_ID}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating })
      });
    } catch {}
  };

  function showTyping() {
    typing.classList.add('active');
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    typing.classList.remove('active');
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage(text, 'user');
    showTyping();
    sendBtn.disabled = true;

    // Use tenant-specific endpoint if tenant ID provided
    const endpoint = TENANT_ID
      ? `${API_URL}/api/chat/${TENANT_ID}`
      : `${API_URL}/api/chat`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId })
      });
      const data = await res.json();
      sessionId = data.sessionId;
      hideTyping();
      addMessage(data.reply || 'Sorry, I could not get a response.', 'bot', true);
    } catch {
      hideTyping();
      addMessage('Sorry, I am having trouble connecting. Please try again.', 'bot');
    }

    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();