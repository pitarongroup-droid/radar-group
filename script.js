document.addEventListener('DOMContentLoaded', () => {

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
    burger.classList.toggle('active', open);
    mobileMenu.classList.toggle('active', open);
    mobileOverlay.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (burger) burger.addEventListener('click', () => toggleMenu(!burger.classList.contains('active')));
  if (mobileOverlay) mobileOverlay.addEventListener('click', () => toggleMenu(false));
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => toggleMenu(false));
    });
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });

  // ===== ШАПКА ПРИ СКРОЛЛЕ =====
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // ===== ПОЯВЛЕНИЕ СЕКЦИЙ =====
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ===== СЧЁТЧИКИ =====
  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      el.textContent = target >= 1000
        ? prefix + current.toLocaleString('ru-RU') + suffix
        : prefix + current + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target >= 1000
        ? prefix + target.toLocaleString('ru-RU') + suffix
        : prefix + target + suffix;
    }

    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

  // ===== ПЛАВНЫЙ СКРОЛЛ =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '!#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ===== ОПРЕДЕЛЕНИЕ ЯЗЫКА СТРАНИЦЫ =====
  const PAGE_LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';

  // ===== ФОРМА ЗАЯВКИ =====
  const leadForm = document.getElementById('leadForm');
  if (leadForm) {
    const statusEl = document.getElementById('formStatus');

    const nameInput = leadForm.querySelector('[name="name"]');
    const contactInput = leadForm.querySelector('[name="contact"]');
    const commentInput = leadForm.querySelector('[name="comment"]');
    const counterEl = document.getElementById('commentCounter');

    if (nameInput) nameInput.setAttribute('maxlength', '50');

    if (contactInput) {
      contactInput.setAttribute('maxlength', '30');

      contactInput.addEventListener('input', function() {
        let val = this.value;

        if (val.startsWith('@')) {
          this.value = val.replace(/[^a-zA-Z0-9_@]/g, '').slice(0, 32);
        } else {
          this.value = val.replace(/[^\d+\-()\s]/g, '').slice(0, 20);
        }
      });

      contactInput.addEventListener('blur', function() {
        const val = this.value.trim();
        if (!val) { this.setCustomValidity(''); return; }

        if (val.startsWith('@')) {
          if (val.length < 4) {
            this.setCustomValidity('Введите username полностью');
          } else {
            this.setCustomValidity('');
          }
        } else {
          const digits = val.replace(/\D/g, '');
          if (digits.length < 7) {
            this.setCustomValidity('Введите корректный номер');
          } else if (digits.length > 15) {
            this.setCustomValidity('Слишком много цифр');
          } else {
            this.setCustomValidity('');
          }
        }
      });
    }

    if (commentInput) {
      commentInput.setAttribute('maxlength', '500');

      function updateCounter() {
        if (!counterEl) return;
        const len = commentInput.value.length;
        counterEl.textContent = `${len} / 500`;
        counterEl.classList.toggle('warn', len > 450);
      }

      commentInput.addEventListener('input', updateCounter);
      updateCounter();
    }

    const LANG = PAGE_LANG;
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
    const M = MESSAGES[LANG];

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = leadForm.querySelector('.form-submit');
      const originalHTML = submitBtn.innerHTML;

      const name = nameInput.value.trim();
      const contact = contactInput.value.trim();
      const comment = commentInput ? commentInput.value.trim() : '';
      const agree = leadForm.querySelector('[name="agree"]').checked;

      const nicheInput = leadForm.querySelector('input[name="niche"]:checked');
      const niche = nicheInput ? nicheInput.value : '';

      const features = Array.from(
        leadForm.querySelectorAll('input[name="features"]:checked')
      ).map(el => el.value);

      if (!name) { showStatus(M.nameRequired, 'error'); nameInput.focus(); return; }
      if (name.length < 2) { showStatus(M.nameShort, 'error'); nameInput.focus(); return; }
      if (!contact) { showStatus(M.contactRequired, 'error'); contactInput.focus(); return; }

      const isUsername = contact.startsWith('@');
      const digits = contact.replace(/\D/g, '');

      if (isUsername) {
        if (contact.length < 4) { showStatus(M.contactInvalid, 'error'); contactInput.focus(); return; }
      } else {
        if (digits.length < 7 || digits.length > 15) { showStatus(M.contactInvalid, 'error'); contactInput.focus(); return; }
      }

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
            lang: LANG
          })
        });

        const data = await response.json();

        if (data.ok) {
          leadForm.reset();
          leadForm.querySelectorAll('.option-card input').forEach(i => i.checked = false);
          if (counterEl) { counterEl.textContent = '0 / 500'; counterEl.classList.remove('warn'); }
          if (contactInput) contactInput.setCustomValidity('');

          if (typeof zaraz !== 'undefined' && typeof zaraz.track === 'function') {
            zaraz.track('form_submit', {
              category: 'lead',
              niche: niche
            });
          }

          showStatus(M.success, 'success');
        } else {
          console.error('Send error:', data);
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

    function showStatus(message, type) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = 'form-status ' + type;
      clearTimeout(statusEl._t);
      statusEl._t = setTimeout(() => {
        statusEl.className = 'form-status';
      }, 7000);
    }
  }

  // ===== ЧАТ-ВИДЖЕТ =====
  const chatWidget = document.getElementById('chatWidget');
  const chatClose = document.getElementById('chatClose');
  const chatBody = document.getElementById('chatBody');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  window.openChatWidget = function() {
    if (!chatWidget) return;
    chatWidget.classList.add('active');
    chatWidget.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => chatInput && chatInput.focus(), 300);
  };

  window.closeChatWidget = function() {
    if (!chatWidget) return;
    chatWidget.classList.remove('active');
    chatWidget.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (chatClose) {
    chatClose.addEventListener('click', window.closeChatWidget);
  }

  if (chatInput) {
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
      const message = chatInput.value.trim();
      if (!message) return;

      addChatMessage(message, 'user');
      chatInput.value = '';
      chatInput.style.height = '44px';

      // Проверка: похоже ли сообщение на контакт
      const contactPattern = /^@[a-zA-Z0-9_]{3,32}$|^\+?[\d\s\-()]{7,20}$/;

      if (contactPattern.test(message.trim())) {
        // Это контакт — отправляем в Telegram
        const chatHistory = [];
        chatBody.querySelectorAll('.chat-message').forEach(msg => {
          chatHistory.push({
            role: msg.classList.contains('bot') ? 'assistant' : 'user',
            content: msg.textContent
          });
        });

        showChatTyping();
        try {
          await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact: message.trim(),
              history: chatHistory.slice(-10),
              lang: PAGE_LANG
            })
          });
          hideChatTyping();
          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Great! 👍 The engineer will contact you shortly.'
              : 'Отлично! 👍 Инженер свяжется с вами в ближайшее время.',
            'bot'
          );
        } catch (err) {
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

      // Обычное сообщение → AI
      showChatTyping();

      const chatHistory = [];
      chatBody.querySelectorAll('.chat-message').forEach(msg => {
        chatHistory.push({
          role: msg.classList.contains('bot') ? 'assistant' : 'user',
          content: msg.textContent
        });
      });

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory,
            lang: PAGE_LANG
          })
        });

        const data = await response.json();
        hideChatTyping();

        if (response.status === 429) {
          addChatMessage(
            PAGE_LANG === 'en'
              ? 'Too many messages. Please wait a couple of minutes 🙂'
              : 'Слишком много сообщений. Подождите пару минут 🙂',
            'bot'
          );
          return;
        }

        if (data.reply) {
          addChatMessage(data.reply, 'bot');

          // Показываем CTA с полем для контакта
          if (data.contactReady && !document.getElementById('chatCta')) {
            const ctaBlock = document.createElement('div');
            ctaBlock.id = 'chatCta';
            ctaBlock.style.cssText = 'margin-top: 8px; padding: 12px 14px; background: var(--cyan-soft); border: 1px solid var(--cyan); border-radius: 12px;';
            ctaBlock.innerHTML = PAGE_LANG === 'en'
              ? `
                <div style="font-size: 13px; color: var(--cyan); font-weight: 700; margin-bottom: 6px;">🎯 Leave your contact — the engineer will reach out</div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">Type your @username or phone below and press send</div>
              `
              : `
                <div style="font-size: 13px; color: var(--cyan); font-weight: 700; margin-bottom: 6px;">🎯 Оставьте контакт — инженер свяжется</div>
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">Напишите ваш @username или телефон в поле ниже и нажмите отправить</div>
              `;
            chatBody.appendChild(ctaBlock);
            chatBody.scrollTop = chatBody.scrollHeight;
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

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
  function addChatMessage(text, role) {
    if (!chatBody) return;
    const msg = document.createElement('div');
    msg.className = 'chat-message ' + role;
    msg.textContent = text;
    chatBody.appendChild(msg);
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

  // ===== ЗАКРЫТИЕ ЧАТА ПО ESCAPE =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatWidget && chatWidget.classList.contains('active')) {
      window.closeChatWidget();
    }
  });

});