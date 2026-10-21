// ============================================
// Radar Group — Widget v2.0 (Full-Screen Mobile Fix)
// ============================================

(function () {
  'use strict';

  console.log('🟢 [Radar Widget] Версия 2.0 загружена');

  if (window.radarWidgetInitialized) {
    console.warn('[Radar Widget] Скрипт уже загружен.');
    return;
  }
  window.radarWidgetInitialized = true;

  const currentScript = document.currentScript || document.querySelector('script[src*="widget.js"]');
  const API_KEY = currentScript?.getAttribute('data-key');
  const LANG = currentScript?.getAttribute('data-lang') || document.documentElement.lang || 'ru';

  if (!API_KEY) {
    console.error('[Radar Widget] data-key не указан');
    return;
  }

  const API_BASE = 'https://radar-group.org';
  const DIALOG_KEY = 'radar_dialog_' + API_KEY;
  const HISTORY_KEY = 'radar_history_' + API_KEY;
  const CHAT_OPEN_KEY = 'radar_chat_opened_' + API_KEY;

  let config = null;
  let dialogId = localStorage.getItem(DIALOG_KEY) || null;
  let messages = [];
  try { messages = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) { messages = []; }

  let isOpen = false;
  let isSending = false;

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-20)));
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[match];
    });
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/widget-config?key=${API_KEY}&lang=${LANG}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.ru || 'Config load failed');
      config = data;
      return data;
    } catch (err) {
      console.error('[Radar Widget] Config error:', err);
      return null;
    }
  }

  function trackChatOpen() {
    if (sessionStorage.getItem(CHAT_OPEN_KEY)) return;
    sessionStorage.setItem(CHAT_OPEN_KEY, '1');

    fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, event_name: 'chat_open', dialog_id: dialogId, lang: LANG })
    }).catch(() => {});
  }

  function adjustMobileHeight() {
    const win = document.getElementById('radar-widget-window');
    if (!win) return;

    if (window.innerWidth <= 640) {
      if (window.visualViewport) {
        win.style.height = `${window.visualViewport.height}px`;
        win.style.maxHeight = `${window.visualViewport.height}px`;
        win.style.top = `${window.visualViewport.offsetTop}px`;
      } else {
        win.style.height = `${window.innerHeight}px`;
        win.style.maxHeight = `${window.innerHeight}px`;
        win.style.top = '0px';
      }
    } else {
      win.style.height = '';
      win.style.maxHeight = '';
      win.style.top = '';
    }
  }

  function createWidget() {
    if (document.getElementById('radar-widget-root')) return;

    const root = document.createElement('div');
    root.id = 'radar-widget-root';

    let messagesHtml = messages.length > 0 
      ? messages.map(m => `<div class="rw-msg ${m.role === 'user' ? 'user' : 'bot'}">${escapeHTML(m.content)}</div>`).join('')
      : `<div class="rw-msg bot">${escapeHTML(config.welcome)}</div>`;

    root.innerHTML = `
      <style>
        /* Блокируем скролл фона и убираем горизонтальный скролл */
        body.rw-no-scroll {
          overflow: hidden !important;
          overflow-x: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
          touch-action: none !important;
        }
        #radar-widget-root {
          --rw-color: ${config.color};
          position: fixed;
          ${config.position === 'left' ? 'left: 24px;' : 'right: 24px;'}
          bottom: 24px;
          z-index: 2147483647 !important;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.4;
        }
        #radar-widget-btn {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: var(--rw-color) !important;
          border: none !important;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0, 240, 255, 0.35);
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        #radar-widget-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 12px 32px rgba(0, 240, 255, 0.5);
        }
        #radar-widget-btn svg { width: 28px; height: 28px; color: #fff !important; }
        #radar-widget-btn.hidden { display: none !important; }

        #radar-widget-window {
          position: fixed;
          ${config.position === 'left' ? 'left: 24px;' : 'right: 24px;'}
          bottom: 100px;
          width: 380px;
          max-width: calc(100vw - 32px);
          height: 560px;
          max-height: calc(100vh - 140px);
          background: #0F0F1A !important;
          border: 1px solid rgba(0, 240, 255, 0.3) !important;
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
          display: none;
          flex-direction: column;
          overflow: hidden;
          color: #F8FAFC !important;
          box-sizing: border-box !important;
        }
        #radar-widget-window.open { display: flex !important; }
        #radar-widget-window * { box-sizing: border-box !important; }

        .rw-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(168, 85, 247, 0.08));
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; gap: 12px; flex-shrink: 0;
        }
        .rw-avatar {
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--rw-color) !important;
          display: flex; align-items: center; justify-content: center;
          color: #fff !important; font-weight: 800; font-size: 16px;
        }
        .rw-header-text { flex: 1; }
        .rw-title { font-size: 15px; font-weight: 700; color: #fff !important; }
        .rw-status { font-size: 12px; color: var(--rw-color) !important; display: flex; align-items: center; gap: 6px; }
        .rw-status::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: var(--rw-color) !important; box-shadow: 0 0 8px var(--rw-color);
        }
        
        .rw-close {
          width: 32px !important; height: 32px !important; border-radius: 8px !important;
          background: rgba(255, 255, 255, 0.08) !important; 
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          cursor: pointer !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          padding: 0 !important; margin: 0 !important;
          font-size: 20px !important; line-height: 1 !important;
          color: var(--rw-color) !important;
          font-family: Arial, sans-serif !important; font-weight: bold !important;
          transition: 0.2s ease !important;
        }
        .rw-close:hover { 
          background: var(--rw-color) !important; color: #0F0F1A !important; border-color: var(--rw-color) !important;
        }

        .rw-body {
          flex: 1; padding: 20px; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; gap: 12px;
          width: 100% !important; /* Жестко на всю ширину */
        }
        .rw-body::-webkit-scrollbar { width: 6px; }
        .rw-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        .rw-msg {
          max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5;
          word-wrap: break-word; white-space: pre-wrap;
        }
        .rw-msg.bot {
          align-self: flex-start; background: #16162A !important; border: 1px solid rgba(255,255,255,0.08) !important;
          color: #F8FAFC !important; border-bottom-left-radius: 4px;
        }
        .rw-msg.user {
          align-self: flex-end; background: var(--rw-color) !important; color: #fff !important; border-bottom-right-radius: 4px;
        }
        .rw-typing {
          align-self: flex-start; display: flex; gap: 4px; padding: 14px 18px;
          background: #16162A !important; border-radius: 16px; border-bottom-left-radius: 4px;
        }
        .rw-typing span {
          width: 6px; height: 6px; border-radius: 50%; background: #64748B !important; animation: rwDot 1.4s infinite;
        }
        .rw-typing span:nth-child(2) { animation-delay: 0.2s; }
        .rw-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes rwDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }

        .rw-cta {
          padding: 12px 14px; background: rgba(0, 240, 255, 0.08) !important; border: 1px solid var(--rw-color) !important;
          border-radius: 12px; font-size: 13px; color: var(--rw-color) !important; text-align: center;
        }
        .rw-footer {
          padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.08); background: #0A0A18 !important;
          display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
          width: 100% !important; /* Жестко на всю ширину */
        }
        .rw-input {
          flex: 1; padding: 12px 16px; background: #0F0F1A !important; border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px; color: #fff !important; font-family: inherit; font-size: 16px; resize: none; max-height: 100px; min-height: 44px; outline: none;
        }
        .rw-input:focus { border-color: var(--rw-color) !important; background: #16162A !important; }
        .rw-input::placeholder { color: #64748B !important; }
        .rw-send {
          width: 44px; height: 44px; border-radius: 12px; background: var(--rw-color) !important; border: none !important;
          color: #fff !important; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .rw-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .rw-send svg { width: 18px; height: 18px; }

        .rw-note {
          padding: 8px 16px 12px; text-align: center; font-size: 11px; color: #64748B !important; background: #0A0A18 !important;
        }
        .rw-note a { color: var(--rw-color) !important; text-decoration: none; }

        /* МОБИЛЬНАЯ ВЕРСИЯ */
        @media (max-width: 640px) {
          #radar-widget-window {
            position: fixed !important;
            left: 0 !important; 
            right: 0 !important;
            width: 100% !important; /* ИСПРАВЛЕНО: 100% вместо 100vw */
            max-width: 100% !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          .rw-body {
            padding-bottom: 20px !important;
          }
        }
      </style>

      <button id="radar-widget-btn" aria-label="Открыть чат">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <div id="radar-widget-window">
        <div class="rw-header">
          <div class="rw-avatar">AI</div>
          <div class="rw-header-text">
            <div class="rw-title">${escapeHTML(config.title)}</div>
            <div class="rw-status">Онлайн</div>
          </div>
          <button class="rw-close" aria-label="Закрыть">✕</button>
        </div>
        <div class="rw-body" id="radar-widget-body">
          ${messagesHtml}
        </div>
        <div class="rw-footer">
          <textarea class="rw-input" id="radar-widget-input" placeholder="Напишите сообщение..." rows="1" maxlength="500"></textarea>
          <button class="rw-send" id="radar-widget-send" aria-label="Отправить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
        <div class="rw-note">Работает на <a href="https://radar-group.org" target="_blank">Radar Group</a></div>
      </div>
    `;

    document.body.appendChild(root);
    const bodyEl = document.getElementById('radar-widget-body');
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', adjustMobileHeight);
      window.visualViewport.addEventListener('scroll', adjustMobileHeight);
    }
    window.addEventListener('resize', adjustMobileHeight);
  }

  async function sendMessage(text) {
    if (!text.trim() || isSending) return;

    const bodyEl = document.getElementById('radar-widget-body');
    const input = document.getElementById('radar-widget-input');
    const sendBtn = document.getElementById('radar-widget-send');

    addMessage(text, 'user');
    messages.push({ role: 'user', content: text });
    saveHistory(); 

    input.value = '';
    input.style.height = 'auto';

    const CONTACT_RE = /@[a-zA-Z0-9_]{3,32}|(?:\+?\d[\d\s\-()]{8,18}\d)/;
    const isContact = CONTACT_RE.test(text.trim());

    isSending = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const payload = isContact
        ? { contact: text.trim(), history: messages.slice(-10), lang: LANG, api_key: API_KEY, dialog_id: dialogId }
        : { messages: messages, lang: LANG, api_key: API_KEY, dialog_id: dialogId };

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      hideTyping();

      if (res.status === 429) {
        addMessage(LANG === 'en' ? 'Too many messages. Please wait 🙂' : 'Слишком много сообщений. Подождите 🙂', 'bot');
        return;
      }

      const data = await res.json();

      if (data.dialog_id && !dialogId) {
        dialogId = data.dialog_id;
        localStorage.setItem(DIALOG_KEY, dialogId);
      }

      if (isContact) {
        const successMsg = LANG === 'en' ? '✅ Great! The manager will contact you shortly.' : '✅ Отлично! Менеджер свяжется с вами в ближайшее время.';
        addMessage(successMsg, 'bot');
        messages.push({ role: 'assistant', content: successMsg });
        saveHistory(); 
      } else if (data.reply) {
        addMessage(data.reply, 'bot');
        messages.push({ role: 'assistant', content: data.reply });
        saveHistory(); 

        if (data.contactReady && !document.querySelector('.rw-cta')) {
          const cta = document.createElement('div');
          cta.className = 'rw-cta';
          cta.textContent = LANG === 'en' ? '🎯 Leave your phone — manager will reach out' : '🎯 Оставьте телефон — менеджер свяжется';
          bodyEl.appendChild(cta);
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }
      } else if (data.error) {
        addMessage(LANG === 'en' ? 'Error: ' + data.error : 'Ошибка: ' + data.error, 'bot');
      } else {
        addMessage(LANG === 'en' ? 'Error. Try again.' : 'Произошла ошибка. Попробуйте позже.', 'bot');
      }
    } catch (err) {
      hideTyping();
      addMessage(LANG === 'en' ? 'Network error.' : 'Ошибка сети.', 'bot');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
    }
  }

  function addMessage(text, role) {
    const body = document.getElementById('radar-widget-body');
    const msg = document.createElement('div');
    msg.className = 'rw-msg ' + role;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const body = document.getElementById('radar-widget-body');
    const typing = document.createElement('div');
    typing.className = 'rw-typing';
    typing.id = 'radar-widget-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('radar-widget-typing')?.remove();
  }

  async function init() {
    const cfg = await loadConfig();
    if (!cfg) return;

    createWidget();

    document.addEventListener('click', function(e) {
      const btn = e.target.closest('#radar-widget-btn');
      const closeBtn = e.target.closest('.rw-close');

      if (btn) {
        const win = document.getElementById('radar-widget-window');
        if (win) {
          win.classList.add('open');
          btn.classList.add('hidden');
          
          const bodyEl = document.getElementById('radar-widget-body');
          if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;

          if (window.innerWidth <= 640) {
            document.body.classList.add('rw-no-scroll');
            adjustMobileHeight();
          }
          
          trackChatOpen();
          const input = document.getElementById('radar-widget-input');
          if (input) setTimeout(() => { input.focus(); adjustMobileHeight(); }, 300); 
        }
      } else if (closeBtn) {
        const win = document.getElementById('radar-widget-window');
        const btn = document.getElementById('radar-widget-btn');
        if (win && btn) {
          win.classList.remove('open');
          btn.classList.remove('hidden');
          document.body.classList.remove('rw-no-scroll');
          
          win.style.height = '';
          win.style.maxHeight = '';
          win.style.top = '';
        }
      }
    });

    const sendBtn = document.getElementById('radar-widget-send');
    const input = document.getElementById('radar-widget-input');

    if (sendBtn) sendBtn.addEventListener('click', () => sendMessage(input.value));

    if (input) {
      input.addEventListener('focus', () => {
        if (window.innerWidth <= 640) setTimeout(adjustMobileHeight, 100);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value);
        }
      });

      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();