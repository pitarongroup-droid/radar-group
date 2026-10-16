// ============================================
// Radar Group — Widget v1.1
// Установка:
// <script src="https://radar-group.org/widget.js"
//         data-key="rg_live_xxx"
//         data-lang="ru"
//         async></script>
// ============================================

(function () {
  'use strict';

  const currentScript = document.currentScript;
  const API_KEY = currentScript?.getAttribute('data-key');
  const LANG = currentScript?.getAttribute('data-lang')
    || document.documentElement.lang
    || 'ru';

  if (!API_KEY) {
    console.error('[Radar Widget] data-key не указан');
    return;
  }

  const API_BASE = 'https://radar-group.org';
  const DIALOG_KEY = 'radar_dialog_' + API_KEY;
  const CHAT_OPEN_KEY = 'radar_chat_opened_' + API_KEY;

  let config = null;
  let dialogId = localStorage.getItem(DIALOG_KEY) || null;
  let messages = [];
  let isOpen = false;
  let isSending = false;

  // ============================================
  // 1. Загрузка конфига
  // ============================================
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

  // ============================================
  // 2. Отправка события chat_open (1 раз за сессию)
  // ============================================
  function trackChatOpen() {
    if (sessionStorage.getItem(CHAT_OPEN_KEY)) return;
    sessionStorage.setItem(CHAT_OPEN_KEY, '1');

    fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEY,
        event_name: 'chat_open',
        dialog_id: dialogId,
        lang: LANG
      })
    }).catch(() => {});
  }

  // ============================================
  // 3. Создание HTML виджета
  // ============================================
  function createWidget() {
    const root = document.createElement('div');
    root.id = 'radar-widget-root';
    root.innerHTML = `
      <style>
        #radar-widget-root {
          --rw-color: ${config.color};
          position: fixed;
          ${config.position === 'left' ? 'left: 24px;' : 'right: 24px;'}
          bottom: 24px;
          z-index: 99999;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #radar-widget-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--rw-color);
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0, 240, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        #radar-widget-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 12px 32px rgba(0, 240, 255, 0.5);
        }
        #radar-widget-btn svg { width: 28px; height: 28px; color: #fff; }
        #radar-widget-btn.hidden { display: none; }

        #radar-widget-window {
          position: fixed;
          ${config.position === 'left' ? 'left: 24px;' : 'right: 24px;'}
          bottom: 100px;
          width: 380px;
          max-width: calc(100vw - 32px);
          height: 560px;
          max-height: calc(100vh - 140px);
          background: #0F0F1A;
          border: 1px solid rgba(0, 240, 255, 0.3);
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
          display: none;
          flex-direction: column;
          overflow: hidden;
          color: #F8FAFC;
        }
        #radar-widget-window.open { display: flex; }

        .rw-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(168, 85, 247, 0.08));
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rw-avatar {
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--rw-color);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800; font-size: 16px;
        }
        .rw-header-text { flex: 1; }
        .rw-title { font-size: 15px; font-weight: 700; color: #fff; }
        .rw-status { font-size: 12px; color: var(--rw-color); display: flex; align-items: center; gap: 6px; }
        .rw-status::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: var(--rw-color); box-shadow: 0 0 8px var(--rw-color);
        }
        .rw-close {
          width: 32px; height: 32px; border-radius: 8px;
          background: transparent; border: 1px solid rgba(255,255,255,0.1);
          color: #94A3B8; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .rw-close:hover { color: var(--rw-color); border-color: var(--rw-color); }

        .rw-body {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex; flex-direction: column; gap: 12px;
        }
        .rw-body::-webkit-scrollbar { width: 6px; }
        .rw-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        .rw-msg {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          white-space: pre-wrap;
        }
        .rw-msg.bot {
          align-self: flex-start;
          background: #16162A;
          border: 1px solid rgba(255,255,255,0.08);
          color: #F8FAFC;
          border-bottom-left-radius: 4px;
        }
        .rw-msg.user {
          align-self: flex-end;
          background: var(--rw-color);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .rw-typing {
          align-self: flex-start;
          display: flex; gap: 4px;
          padding: 14px 18px;
          background: #16162A;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
        }
        .rw-typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #64748B;
          animation: rwDot 1.4s infinite;
        }
        .rw-typing span:nth-child(2) { animation-delay: 0.2s; }
        .rw-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes rwDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }

        .rw-cta {
          padding: 12px 14px;
          background: rgba(0, 240, 255, 0.08);
          border: 1px solid var(--rw-color);
          border-radius: 12px;
          font-size: 13px;
          color: var(--rw-color);
          text-align: center;
        }

        .rw-footer {
          padding: 14px 16px;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: #0A0A18;
          display: flex; gap: 8px; align-items: flex-end;
        }
        .rw-input {
          flex: 1;
          padding: 12px 16px;
          background: #0F0F1A;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-family: inherit;
          font-size: 16px;
          resize: none;
          max-height: 100px;
          min-height: 44px;
          outline: none;
        }
        .rw-input:focus {
          border-color: var(--rw-color);
          background: #16162A;
        }
        .rw-input::placeholder { color: #64748B; }
        .rw-send {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: var(--rw-color);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .rw-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .rw-send svg { width: 18px; height: 18px; }

        .rw-note {
          padding: 8px 16px 12px;
          text-align: center;
          font-size: 11px;
          color: #64748B;
          background: #0A0A18;
        }
        .rw-note a { color: var(--rw-color); text-decoration: none; }

        @media (max-width: 640px) {
          #radar-widget-window {
            left: 0; right: 0; bottom: 0;
            width: 100%; height: 100vh; max-height: 100vh;
            border-radius: 0;
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
            <div class="rw-title">${config.title}</div>
            <div class="rw-status">Онлайн</div>
          </div>
          <button class="rw-close" aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="rw-body" id="radar-widget-body">
          <div class="rw-msg bot">${config.welcome}</div>
        </div>

        <div class="rw-footer">
          <textarea class="rw-input" id="radar-widget-input" placeholder="Напишите сообщение..." rows="1" maxlength="500"></textarea>
          <button class="rw-send" id="radar-widget-send" aria-label="Отправить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13"/>
              <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>

        <div class="rw-note">
          Работает на <a href="https://radar-group.org" target="_blank">Radar Group</a>
        </div>
      </div>
    `;

    document.body.appendChild(root);
  }

  // ============================================
  // 4. Отправка сообщения
  // ============================================
  async function sendMessage(text) {
    if (!text.trim() || isSending) return;

    const bodyEl = document.getElementById('radar-widget-body');
    const input = document.getElementById('radar-widget-input');
    const sendBtn = document.getElementById('radar-widget-send');

    addMessage(text, 'user');
    messages.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';

    const CONTACT_RE = /^@[a-zA-Z0-9_]{3,32}$|^\+?[\d\s\-()]{7,20}$/;
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
        addMessage(LANG === 'en'
          ? 'Too many messages. Please wait a couple of minutes 🙂'
          : 'Слишком много сообщений. Подождите пару минут 🙂', 'bot');
        return;
      }

      const data = await res.json();

      if (data.dialog_id && !dialogId) {
        dialogId = data.dialog_id;
        localStorage.setItem(DIALOG_KEY, dialogId);
      }

      if (isContact) {
        addMessage(LANG === 'en'
          ? '✅ Great! The manager will contact you shortly.'
          : '✅ Отлично! Менеджер свяжется с вами в ближайшее время.', 'bot');
      } else if (data.reply) {
        addMessage(data.reply, 'bot');
        messages.push({ role: 'assistant', content: data.reply });

        if (data.contactReady && !document.querySelector('.rw-cta')) {
          const cta = document.createElement('div');
          cta.className = 'rw-cta';
          cta.textContent = LANG === 'en'
            ? '🎯 Leave your @username or phone — the manager will reach out'
            : '🎯 Оставьте @username или телефон — менеджер свяжется';
          bodyEl.appendChild(cta);
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }
      } else if (data.error) {
        addMessage(LANG === 'en'
          ? 'Sorry, an error occurred: ' + data.error
          : 'Извините, ошибка: ' + data.error, 'bot');
      } else {
        addMessage(LANG === 'en'
          ? 'Sorry, an error occurred. Please try again.'
          : 'Извините, произошла ошибка. Попробуйте позже.', 'bot');
      }
    } catch (err) {
      hideTyping();
      console.error('[Radar Widget] Send error:', err);
      addMessage(LANG === 'en'
        ? 'Network error. Please try again.'
        : 'Ошибка сети. Попробуйте позже.', 'bot');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
    }
  }

  // ============================================
  // 5. Вспомогательные
  // ============================================
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

  // ============================================
  // 6. Инициализация
  // ============================================
  async function init() {
    const cfg = await loadConfig();
    if (!cfg) return;

    createWidget();

    const btn = document.getElementById('radar-widget-btn');
    const win = document.getElementById('radar-widget-window');
    const closeBtn = win.querySelector('.rw-close');
    const input = document.getElementById('radar-widget-input');
    const sendBtn = document.getElementById('radar-widget-send');

    btn.addEventListener('click', () => {
      isOpen = true;
      win.classList.add('open');
      btn.classList.add('hidden');
      trackChatOpen();
      setTimeout(() => input.focus(), 200);
    });

    closeBtn.addEventListener('click', () => {
      isOpen = false;
      win.classList.remove('open');
      btn.classList.remove('hidden');
    });

    sendBtn.addEventListener('click', () => sendMessage(input.value));

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

  // ============================================
  // 7. Запуск
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();