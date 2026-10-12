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

  // ===== ПЛАВНЫЙ СКРОЛЛ (только для якорей на текущей странице) =====
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

  // ===== ФОРМА ЗАЯВКИ =====
  const leadForm = document.getElementById('leadForm');
  if (leadForm) {
    const statusEl = document.getElementById('formStatus');

    const nameInput = leadForm.querySelector('[name="name"]');
    const contactInput = leadForm.querySelector('[name="contact"]');
    const commentInput = leadForm.querySelector('[name="comment"]');
    const counterEl = document.getElementById('commentCounter');

    if (nameInput) nameInput.setAttribute('maxlength', '50');
    if (contactInput) contactInput.setAttribute('maxlength', '50');

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

    const LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';
    const MESSAGES = {
      ru: {
        nameRequired: 'Укажите, как вас зовут',
        nameShort: 'Имя слишком короткое',
        contactRequired: 'Оставьте Telegram или телефон для связи',
        contactShort: 'Контакт слишком короткий',
        nicheRequired: 'Выберите вашу нишу',
        agreeRequired: 'Необходимо согласие на обработку данных',
        sending: 'Отправляем...',
        success: '✅ Заявка отправлена! Свяжусь с вами в течение 15 минут.',
        errorSend: 'Не удалось отправить. Напишите напрямую в Telegram.',
        errorNet: 'Ошибка сети. Напишите напрямую в Telegram.'
      },
      en: {
        nameRequired: 'Please enter your name',
        nameShort: 'Name is too short',
        contactRequired: 'Please leave your Telegram or phone',
        contactShort: 'Contact is too short',
        nicheRequired: 'Please select your niche',
        agreeRequired: 'Please agree to data processing',
        sending: 'Sending...',
        success: '✅ Request sent! I will contact you within 15 minutes.',
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
      if (contact.length < 3) { showStatus(M.contactShort, 'error'); contactInput.focus(); return; }
      if (!niche) { showStatus(M.nicheRequired, 'error'); return; }
      if (!agree) { showStatus(M.agreeRequired, 'error'); return; }

      submitBtn.disabled = true;
      submitBtn.innerHTML = M.sending;

      try {
        // Отправка на Cloudflare Function /api/send
        // Токен бота хранится в Environment Variables Cloudflare — безопасно
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
          if (counterEl) {
            counterEl.textContent = '0 / 500';
            counterEl.classList.remove('warn');
          }

                   // Отправка события в Google Analytics 4 (через Zaraz)
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

});