// ============================================
// app-lang.js — Переключатель языка в кабинете клиента
// ============================================

(function () {
  'use strict';

  const path = window.location.pathname;
  let currentLang, targetLang, targetPath;

  // Определяем текущий язык по URL
  if (path.startsWith('/en/app/')) {
    currentLang = 'en';
    targetLang = 'ru';
    targetPath = path.replace('/en/app/', '/app/');
  } else if (path.startsWith('/app/')) {
    currentLang = 'ru';
    targetLang = 'en';
    targetPath = path.replace('/app/', '/en/app/');
  } else {
    return; // Не кабинет — ничего не делаем
  }

  // Сохраняем query-параметры (например, ?id=xxx для диалогов)
  const fullTarget = targetPath + window.location.search;

  // Стили кнопки
  const style = document.createElement('style');
  style.textContent = `
    .app-lang-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 36px;
      padding: 0 12px;
      border-radius: 100px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
      transition: var(--transition);
      flex-shrink: 0;
    }
    .app-lang-btn:hover {
      color: var(--cyan);
      border-color: var(--cyan);
      background: var(--cyan-soft);
      transform: translateY(-1px);
    }
    @media (max-width: 640px) {
      .app-lang-btn {
        min-width: 34px;
        height: 32px;
        padding: 0 8px;
        font-size: 11px;
      }
    }
  `;
  document.head.appendChild(style);

  // Функция вставки кнопки в шапку
  function insertSwitcher() {
    const userEl = document.querySelector('.app-header-user');
    if (!userEl) {
      // Шапка ещё не отрендерилась — попробуем позже
      setTimeout(insertSwitcher, 100);
      return;
    }

    // Если уже вставлено — не дублируем
    if (document.getElementById('lang-switcher')) return;

    const switcher = document.createElement('a');
    switcher.id = 'lang-switcher';
    switcher.href = fullTarget;
    switcher.className = 'app-lang-btn';
    switcher.title = currentLang === 'ru' ? 'Switch to English' : 'Переключить на русский';
    switcher.textContent = targetLang.toUpperCase(); // "EN" или "RU"

    userEl.parentNode.insertBefore(switcher, userEl);
  }

  // Ждем загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertSwitcher);
  } else {
    insertSwitcher();
  }

})();