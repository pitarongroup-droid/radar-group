document.addEventListener('DOMContentLoaded', () => {

  // ===== КОНСТАНТЫ =====
  const PAGE_LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';
  const CONTACT_RE = /^@[a-zA-Z0-9_]{3,32}$|^\+?[\d\s\-()]{7,20}$/;
  const MAX_COMMENT = 500;
  const MAX_NAME = 50;
  const MAX_CONTACT = 30;
  const COUNTER_DURATION = 1800;
  const SCROLL_OFFSET = 80;
  const STATUS_TIMEOUT = 7000;

  // ===== АВТО-ФИКС МОБИЛЬНОГО МЕНЮ (АККОРДЕОН) =====
  const mobileNavUl = document.querySelector('.mobile-menu ul');
  if (mobileNavUl) {
    // 1. Проверяем, есть ли старое меню (текст "Услуги:" вместо кнопки)
    const serviceSpan = Array.from(mobileNavUl.querySelectorAll('span')).find(el => 
      el.textContent.includes('Услуги') || el.textContent.includes('Services')
    );

    if (serviceSpan && !mobileNavUl.querySelector('.mobile-accordion')) {
      const parentLi = serviceSpan.closest('li');
      const submenu = parentLi.querySelector('.mobile-submenu');
      
      if (parentLi && submenu) {
        const isEn = window.location.pathname.includes('/en/');
        const servicesText = isEn ? 'Services' : 'Услуги';
        
        // Переделываем HTML старого меню в аккордеон
        parentLi.className = 'mobile-accordion';
        parentLi.innerHTML = `
          <button class="mobile-accordion-btn">
            ${servicesText}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          ${submenu.outerHTML}
        `;
      }
    }

    // 2. Теперь вешаем обработчик на кнопку (она уже есть в HTML или мы её только что создали)
    const accordionBtn = mobileNavUl.querySelector('.mobile-accordion-btn');
    if (accordionBtn) {
      // Клонируем кнопку, чтобы сбросить старые обработчики (если были)
      const newAccordionBtn = accordionBtn.cloneNode(true);
      accordionBtn.parentNode.replaceChild(newAccordionBtn, accordionBtn);

      newAccordionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        newAccordionBtn.closest('.mobile-accordion').classList.toggle('open');
      });
    }
  }

  // ===== АВТО-ДОБАВЛЕНИЕ ССЫЛКИ "ТАРИФЫ" В МЕНЮ =====
  const isEnPage = window.location.pathname.includes('/en/');
  const pricingText = isEnPage ? 'Pricing' : 'Тарифы';

  // 1. Десктопное меню
  const desktopNav = document.querySelector('.nav');
  if (desktopNav && !desktopNav.querySelector('a[href="pricing.html"]')) {
    const pricingLi = document.createElement('li');
    pricingLi.innerHTML = `<a href="pricing.html">${pricingText}</a>`;
    const firstLi = desktopNav.querySelector('li');
    if (firstLi) firstLi.after(pricingLi);
  }

  // 2. Мобильное меню (вставляем после аккордеона)
  if (mobileNavUl && !mobileNavUl.querySelector('a[href="pricing.html"]')) {
    const pricingLi = document.createElement('li');
    pricingLi.innerHTML = `<a href="pricing.html">${pricingText}</a>`;
    const mobileAccordion = mobileNavUl.querySelector('.mobile-accordion');
    if (mobileAccordion) mobileAccordion.after(pricingLi);
  }

  // ===== АВТО-ЗАМЕНА СТАРОГО ПОДВАЛА НА НОВЫЙ =====
  const footerContainer = document.querySelector('.footer .container');
  
  if (footerContainer && !footerContainer.querySelector('.footer-main')) {
    const isEn = window.location.pathname.includes('/en/');
    const prefix = isEn ? '../' : '';
    
    footerContainer.innerHTML = `
      <div class="footer-main">
        <div class="footer-brand">
          <a href="index.html" class="footer-logo">
            <img src="/images/logo.webp" alt="Radar Group" width="36" height="36">
            <span class="logo-text">RADAR GROUP</span>
          </a>
          <p class="footer-copy">${isEn ? 'AI Manager trained for your product. Sells in Telegram and on the website 24/7.' : 'ИИ-менеджер, обученный под ваш продукт. Продаёт в Telegram и на сайте 24/7.'}</p>
        </div>
        <nav class="footer-columns">
          <div class="footer-col">
            <div class="footer-title">${isEn ? 'Services' : 'Услуги'}</div>
            <ul class="footer-links-col">
              <li><a href="services-telegram-business.html">Telegram Business</a></li>
              <li><a href="services-telegram-bot.html">${isEn ? 'Telegram Bot' : 'Telegram-бот'}</a></li>
              <li><a href="services-widget.html">${isEn ? 'Website Widget' : 'Виджет на сайт'}</a></li>
              <li><a href="services-webdev.html">${isEn ? 'Web Development' : 'Создание сайтов'}</a></li>
              <li><a href="services-crm.html">${isEn ? 'CRM Integrations' : 'Интеграции с CRM'}</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <div class="footer-title">${isEn ? 'Company' : 'Компания'}</div>
            <ul class="footer-links-col">
              <li><a href="index.html">${isEn ? 'Home' : 'Главная'}</a></li>
              <li><a href="pricing.html">${isEn ? 'Pricing' : 'Тарифы'}</a></li>
              <li><a href="cases.html">${isEn ? 'Cases' : 'Кейсы'}</a></li>
              <li><a href="about.html">${isEn ? 'Technology' : 'О технологии'}</a></li>
              <li><a href="index.html#lead">${isEn ? 'Get a quote' : 'Оставить заявку'}</a></li>
              <li><a href="/app/login.html">${isEn ? 'Sign in' : 'Войти в кабинет'}</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <div class="footer-title">${isEn ? 'Documents' : 'Документы'}</div>
            <ul class="footer-links-col">
              <li><a href="${prefix}sitemap.xml">${isEn ? 'Sitemap' : 'Карта сайта'}</a></li>
              <li><a href="privacy.html">${isEn ? 'Privacy Policy' : 'Политика конфиденциальности'}</a></li>
            </ul>
          </div>
        </nav>
      </div>
      <div class="footer-bottom">
        <div class="footer-copy">© 2026 Radar Group. ${isEn ? 'All rights reserved.' : 'Все права защищены.'}</div>
        <a href="https://t.me/my_ai_TGAgency_bot" class="footer-tg" target="_blank" rel="noopener">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.6 8.4l-2 9.4c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.1.1-.3.2-.5.2l.2-2.9 5.3-4.8c.2-.2 0-.3-.4-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.1-.9l11-4.2c.5-.2 1 .1.9.4z"/></svg>
        </a>
      </div>
    `;
  }

  // ===== БЕЗОПАСНЫЙ ТРЕКИНГ =====
  function track(eventName, params = {}) {
    try {
      if (typeof zaraz !== 'undefined' && typeof zaraz.track === 'function') {
        zaraz.track(eventName, params);
        console.log('[Zaraz] tracked:', eventName, params);
      } else {
        console.warn('[Zaraz] not available, skip:', eventName);
      }
    } catch (err) {
      console.error('[Zaraz] track error:', eventName, err);
    }
  }

  // ===== БЛОКИРОВКА СКРОЛЛА (счётчик) =====
  let scrollLocks = 0;
  function lockScroll() {
    scrollLocks++;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = '';
  }

  // ===== ЛОГО: не перезагружаем текущую страницу =====
  document.querySelectorAll('.logo').forEach(logo => {
    logo.addEventListener('click', function(e) {
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const logoHref = this.getAttribute('href');
      if (logoHref === currentPath || (currentPath === '' && logoHref === 'index.html')) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // ===== БУРГЕР =====
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileOverlay = document.getElementById('mobileOverlay');

  function toggleMenu(open) {
    if (!burger || !mobileMenu || !mobileOverlay) return;
    const isOpen = burger.classList.contains('active');
    if (isOpen === open) return;

    burger.classList.toggle('active', open);
    mobileMenu.classList.toggle('active', open);
    mobileOverlay.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');

    if (open) lockScroll();
    else unlockScroll();
  }

  if (burger) burger.addEventListener('click', () => toggleMenu(!burger.classList.contains('active')));
  if (mobileOverlay) mobileOverlay.addEventListener('click', () => toggleMenu(false));
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => toggleMenu(false));
    });
  }

  // ===== ШАПКА ПРИ СКРОЛЛЕ =====
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // ===== ПОЯВЛЕНИЕ СЕКЦИЙ =====
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  // ===== СЧЁТЧИКИ =====
  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const start = performance.now();

    function format(value) {
      return target >= 1000
        ? prefix + value.toLocaleString('ru-RU') + suffix
        : prefix + value + suffix;
    }

    function step(now) {
      const progress = Math.min((now - start) / COUNTER_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      el.textContent = format(current);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = format(target);
    }

    requestAnimationFrame(step);
  }

  const counterEls = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counterEls.forEach(el => counterObserver.observe(el));
  } else {
    counterEls.forEach(el => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      el.textContent = target >= 1000
        ? prefix + target.toLocaleString('ru-RU') + suffix
        : prefix + target + suffix;
    });
  }

  // ===== ПЛАВНЫЙ СКРОЛЛ =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;

      let target;
      try {
        target = document.querySelector(targetId);
      } catch (err) {
        return;
      }

      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ===== ФОРМА ЗАЯВКИ =====
  const leadForm = document.getElementById('leadForm');
  if (leadForm) {
    const statusEl = document.getElementById('formStatus');
    const nameInput = leadForm.querySelector('[name="name"]');
    const contactInput = leadForm.querySelector('[name="contact"]');
    const commentInput = leadForm.querySelector('[name="comment"]');
    const commentCounter = document.getElementById('commentCounter');

    if (nameInput) nameInput.setAttribute('maxlength', String(MAX_NAME));

    if (contactInput) {
      contactInput.setAttribute('maxlength', String(MAX_CONTACT));

      contactInput.addEventListener('input', function() {
        let val = this.value;
        if (val.startsWith('@')) {
          this.value = val.replace(/[^a-zA-Z0-9_@]/g, '').slice(0, MAX_CONTACT);
        } else {
          this.value = val.replace(/[^\d+\-()\s]/g, '').slice(0, MAX_CONTACT);
        }
      });

      contactInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (!val) { this.setCustomValidity(''); return; }

        if (!CONTACT_RE.test(val)) {
          this.setCustomValidity(
            PAGE_LANG === 'en'
              ? 'Please check the phone or username format'
              : 'Проверьте формат телефона или username'
          );
        } else {
          this.setCustomValidity('');
        }
      });
    }

    if (commentInput) {
      commentInput.setAttribute('maxlength', String(MAX_COMMENT));

      function updateCounter() {
        if (!commentCounter) return;
        const len = commentInput.value.length;
        commentCounter.textContent = `${len} / ${MAX_COMMENT}`;
        commentCounter.classList.toggle('warn', len > MAX_COMMENT * 0.9);
      }
      commentInput.addEventListener('input', updateCounter);
      updateCounter();
    }

    const MESSAGES = {
      ru: {
        nameRequired: 'Укажите, как вас зовут',
        nameShort: 'Имя слишком короткое',
        contactRequired: 'Оставьте Telegram или телефон для связи',
        contactInvalid: 'Проверьте формат телефона или username',
        nicheRequired: 'Выберите вашу нишу',
        agreeRequired: 'Необходимо согласие на обработку данных',
        sending: 'Отправляем...',
        success: '✅ Заявка отправлена! Свяжусь с вами удобным способом.',
        errorSend: 'Не удалось отправить. Напишите напрямую в Telegram.',
        errorNet: 'Ошибка сети. Напишите напрямую в Telegram.'
      },
      en: {
        nameRequired: 'Please enter your name',
        nameShort: 'Name is too short',
        contactRequired: 'Please leave your Telegram or phone',
        contactInvalid: 'Please check the phone or username format',
        nicheRequired: 'Please select your niche',
        agreeRequired: 'Please agree to data processing',
        sending: 'Sending...',
        success: '✅ Request sent! I will contact you in a convenient way.',
        errorSend: 'Failed to send. Please message us on Telegram.',
        errorNet: 'Network error. Please message us on Telegram.'
      }
    };
    const M = MESSAGES[PAGE_LANG];

    function showStatus(message, type) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = 'form-status ' + type;
      clearTimeout(statusEl._t);
      statusEl._t = setTimeout(() => {
        statusEl.className = 'form-status';
      }, STATUS_TIMEOUT);
    }

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = leadForm.querySelector('.form-submit');
      if (!submitBtn) return;
      const originalHTML = submitBtn.innerHTML;

      const name = nameInput ? nameInput.value.trim() : '';
      const contact = contactInput ? contactInput.value.trim() : '';
      const comment = commentInput ? commentInput.value.trim() : '';
      const agreeEl = leadForm.querySelector('[name="agree"]');
      const agree = agreeEl ? agreeEl.checked : false;

      const nicheInput = leadForm.querySelector('input[name="niche"]:checked');
      const niche = nicheInput ? nicheInput.value : '';

      const features = Array.from(
        leadForm.querySelectorAll('input[name="features"]:checked')
      ).map(el => el.value);

      if (!name) { showStatus(M.nameRequired, 'error'); nameInput?.focus(); return; }
      if (name.length < 2) { showStatus(M.nameShort, 'error'); nameInput?.focus(); return; }
      if (!contact) { showStatus(M.contactRequired, 'error'); contactInput?.focus(); return; }
      if (!CONTACT_RE.test(contact)) { showStatus(M.contactInvalid, 'error'); contactInput?.focus(); return; }
      if (!niche) { showStatus(M.nicheRequired, 'error'); return; }
      if (!agree) { showStatus(M.agreeRequired, 'error'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = M.sending;

      try {
        const response = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            contact: contact,
            niche: niche,
            features: features,
            comment: comment,
            lang: PAGE_LANG
          })
        });

        let data = {};
        try { data = await response.json(); } catch (_) {}

        if (response.ok && data.ok) {
          leadForm.reset();
          leadForm.querySelectorAll('.option-card input').forEach(i => i.checked = false);
          if (commentCounter) {
            commentCounter.textContent = `0 / ${MAX_COMMENT}`;
            commentCounter.classList.remove('warn');
          }
          if (contactInput) contactInput.setCustomValidity('');

          track('form_submit', {
            category: 'lead',
            niche: niche
          });

          showStatus(M.success, 'success');
        } else {
          console.error('Send error:', response.status, data);
          showStatus(M.errorSend, 'error');
        }
      } catch (err) {
        console.error('Form error:', err);
        showStatus(M.errorNet, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    });
  }

  // ===== ЧАТ-ВИДЖЕТ =====
  const chatWidget = document.getElementById('chatWidget');
  const chatClose = document.getElementById('chatClose');
  const chatBody = document.getElementById('chatBody');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  let chatOpened = false;

  window.openChatWidget = function() {
    if (!chatWidget) return;
    chatWidget.classList.add('active');
    chatWidget.setAttribute('aria-hidden', 'false');
    lockScroll();
    setTimeout(() => chatInput && chatInput.focus(), 300);

    if (!chatOpened) {
      chatOpened = true;
      track('chat_open');
    }
  };

  window.closeChatWidget = function() {
    if (!chatWidget) return;
    chatWidget.classList.remove('active');
    chatWidget.setAttribute('aria-hidden', 'true');
    unlockScroll();
  };

  if (chatClose) {
    chatClose.addEventListener('click', window.closeChatWidget);
  }

  if (chatInput && chatForm) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });
  }

  // ===== ОТПРАВКА СООБЩЕНИЯ В ЧАТЕ =====
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!chatInput) return;

      const message = chatInput.value.trim();
      if (!message) return;

      addChatMessage(message, 'user');
      chatInput.value = '';
      chatInput.style.height = '';

      const oldCta = document.getElementById('chatCta');
      if (oldCta) oldCta.remove();

      if (CONTACT_RE.test(message)) {
        const chatHistory = getChatHistory();

        showChatTyping();
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact: message,
              history: chatHistory.slice(-10),
              lang: PAGE_LANG
            })
          });

          hideChatTyping();

          if (!response.ok) {
            console.warn('[chat_lead] server status:', response.status);
          }

          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Great! 👍 The engineer will contact you shortly.'
              : 'Отлично! 👍 Инженер свяжется с вами в ближайшее время.',
            'bot'
          );

          track('chat_lead', {
            category: 'lead',
            source: 'chat',
            lang: PAGE_LANG
          });
        } catch (err) {
          console.error('[chat_lead] error:', err);
          hideChatTyping();
          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Got it. If anything goes wrong — message us on Telegram 🙂'
              : 'Записал. Если что-то не так — напишите в Telegram 🙂',
            'bot'
          );
        }
        return;
      }

      track('chat_message');

      showChatTyping();

      const chatHistory = getChatHistory();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory,
            lang: PAGE_LANG
          })
        });

        if (response.status === 429) {
          hideChatTyping();
          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Too many messages. Please wait a couple of minutes 🙂'
              : 'Слишком много сообщений. Подождите пару минут 🙂',
            'bot'
          );
          return;
        }

        let data = {};
        try { data = await response.json(); } catch (_) {}

        hideChatTyping();

        if (data.reply) {
          addChatMessage(data.reply, 'bot');

          if (data.contactReady && !document.getElementById('chatCta')) {
            showContactCta();
          }
        } else {
          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Sorry, an error occurred. Please try again later.'
              : 'Извините, произошла ошибка. Попробуйте позже.',
            'bot'
          );
        }
      } catch (err) {
        console.error('Chat error:', err);
        hideChatTyping();
        addChatMessage(
          PAGE_LANG === 'en'
            ? 'Network error. Please try again later.'
            : 'Ошибка сети. Попробуйте позже.',
          'bot'
        );
      }
    });
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ЧАТА =====
  function getChatHistory() {
    const history = [];
    if (!chatBody) return history;
    chatBody.querySelectorAll('.chat-message').forEach(msg => {
      history.push({
        role: msg.classList.contains('bot') ? 'assistant' : 'user',
        content: msg.textContent
      });
    });
    return history;
  }

  function addChatMessage(text, role) {
    if (!chatBody) return;
    const msg = document.createElement('div');
    msg.className = 'chat-message ' + role;
    msg.textContent = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showContactCta() {
    if (!chatBody) return;
    const ctaBlock = document.createElement('div');
    ctaBlock.id = 'chatCta';
    ctaBlock.style.cssText = 'margin-top: 8px; padding: 12px 14px; background: var(--cyan-soft); border: 1px solid var(--cyan); border-radius: 12px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 13px; color: var(--cyan); font-weight: 700; margin-bottom: 6px;';
    title.textContent = PAGE_LANG === 'en'
      ? '🎯 Leave your contact — the engineer will reach out'
      : '🎯 Оставьте контакт — инженер свяжется';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 12px; color: var(--text-muted); line-height: 1.4;';
    hint.textContent = PAGE_LANG === 'en'
      ? 'Type your @username or phone below and press send'
      : 'Напишите ваш @username или телефон в поле ниже и нажмите отправить';

    ctaBlock.appendChild(title);
    ctaBlock.appendChild(hint);
    chatBody.appendChild(ctaBlock);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showChatTyping() {
    if (!chatBody) return;
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chatTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    chatBody.appendChild(typing);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function hideChatTyping() {
    const typing = document.getElementById('chatTyping');
    if (typing) typing.remove();
  }

  // ===== ЕДИНЫЙ ОБРАБОТЧИК ESCAPE =====
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (chatWidget && chatWidget.classList.contains('active')) {
      window.closeChatWidget();
      return;
    }
    if (burger && burger.classList.contains('active')) {
      toggleMenu(false);
    }
  });

});