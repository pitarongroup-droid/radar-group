// ============================================
// RADAR GROUP — Робот-маскот v6.0
// Следит за мышью · Моргает при наведении
// ============================================

(function () {
  'use strict';

  const MASCOT_ID = 'radar-mascot';
  const SHOW_THRESHOLD = 0.15;
  const TELEGRAM_URL = 'https://t.me/my_ai_TGAgency_bot';

  // ===== SVG РОБОТА =====
  function buildRobotSVG() {
    return `
      <svg class="mascot-svg" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="headGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#22D3EE"/>
            <stop offset="55%" stop-color="#0EA5E9"/>
            <stop offset="100%" stop-color="#3B82F6"/>
          </linearGradient>

          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0EA5E9"/>
            <stop offset="60%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#8B5CF6"/>
          </linearGradient>

          <linearGradient id="armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22D3EE"/>
            <stop offset="100%" stop-color="#8B5CF6"/>
          </linearGradient>

          <radialGradient id="eyeInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="50%" stop-color="#67E8F9"/>
            <stop offset="100%" stop-color="#22D3EE"/>
          </radialGradient>

          <radialGradient id="auraGrad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.3"/>
            <stop offset="60%" stop-color="#A855F7" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#A855F7" stop-opacity="0"/>
          </radialGradient>

          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#06060C"/>
            <stop offset="100%" stop-color="#0A0A18"/>
          </linearGradient>

          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="eyeGlowFilter" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle class="aura" cx="60" cy="65" r="58" fill="url(#auraGrad)"/>

        <g class="body-group">

          <!-- РУКИ -->
          <g class="arm-left">
            <path d="M 28 78 Q 14 80 8 92 Q 4 102 12 108 Q 20 106 26 96 Q 30 86 30 80 Z"
                  fill="url(#armGrad)" opacity="0.85"/>
            <path d="M 28 78 Q 14 80 8 92 Q 4 102 12 108 Q 20 106 26 96 Q 30 86 30 80 Z"
                  fill="none" stroke="#22D3EE" stroke-width="0.6" opacity="0.5"/>
          </g>

          <g class="arm-right callout-hand">
            <path d="M 92 78 Q 106 80 112 92 Q 116 102 108 108 Q 100 106 94 96 Q 90 86 90 80 Z"
                  fill="url(#armGrad)" opacity="0.85"/>
            <path d="M 92 78 Q 106 80 112 92 Q 116 102 108 108 Q 100 106 94 96 Q 90 86 90 80 Z"
                  fill="none" stroke="#22D3EE" stroke-width="0.6" opacity="0.5"/>
          </g>

          <!-- ТЕЛО-КАПСУЛА -->
          <path d="M 40 75 Q 60 72 80 75 Q 78 105 60 122 Q 42 105 40 75 Z"
                fill="url(#bodyGrad)" opacity="0.8"/>
          <path d="M 40 75 Q 60 72 80 75 Q 78 105 60 122 Q 42 105 40 75 Z"
                fill="none" stroke="#22D3EE" stroke-width="0.6" opacity="0.55"/>

          <!-- Poly-сетка -->
          <g class="mesh" stroke="#FFFFFF" stroke-width="0.35" fill="none" opacity="0.35">
            <line x1="45" y1="80" x2="55" y2="90"/>
            <line x1="55" y1="90" x2="48" y2="100"/>
            <line x1="48" y1="100" x2="55" y2="112"/>
            <line x1="55" y1="90" x2="65" y2="88"/>
            <line x1="65" y1="88" x2="75" y2="82"/>
            <line x1="65" y1="88" x2="72" y2="98"/>
            <line x1="72" y1="98" x2="64" y2="110"/>
            <line x1="55" y1="112" x2="64" y2="110"/>
            <line x1="55" y1="90" x2="60" y2="100"/>
            <line x1="60" y1="100" x2="72" y2="98"/>
            <line x1="60" y1="100" x2="64" y2="110"/>
          </g>

          <circle class="mesh-pulse" cx="60" cy="98" r="7" fill="#67E8F9" filter="url(#softGlow)"/>

          <!-- ГОЛОВА -->
          <g class="head-group">
            <ellipse cx="60" cy="55" rx="34" ry="30" fill="url(#headGrad)"/>
            <ellipse cx="60" cy="55" rx="34" ry="30" fill="none" stroke="#22D3EE" stroke-width="0.8" opacity="0.6"/>

            <ellipse cx="54" cy="42" rx="18" ry="8" fill="#FFFFFF" opacity="0.15"/>

            <rect x="34" y="40" width="52" height="32" rx="16" fill="url(#screenGrad)"/>
            <rect x="34" y="40" width="52" height="32" rx="16" fill="none" stroke="#22D3EE" stroke-width="0.7" opacity="0.4"/>

            <!-- ЛЕВЫЙ ГЛАЗ -->
            <g class="eye-group eye-group-left" filter="url(#eyeGlowFilter)">
              <ellipse class="eye-open" cx="48" cy="56" rx="8" ry="8" fill="none" stroke="url(#eyeInner)" stroke-width="2.2"/>
              <circle class="eye-pupil pupil-left" cx="48" cy="56" r="2.8" fill="#FFFFFF" opacity="0.9"/>
              <path class="eye-closed" d="M 40 56 Q 48 62 56 56" fill="none" stroke="url(#eyeInner)" stroke-width="2.2" stroke-linecap="round"/>
            </g>

            <!-- ПРАВЫЙ ГЛАЗ -->
            <g class="eye-group eye-group-right" filter="url(#eyeGlowFilter)">
              <ellipse class="eye-open" cx="72" cy="56" rx="8" ry="8" fill="none" stroke="url(#eyeInner)" stroke-width="2.2"/>
              <circle class="eye-pupil pupil-right" cx="72" cy="56" r="2.8" fill="#FFFFFF" opacity="0.9"/>
              <path class="eye-closed" d="M 64 56 Q 72 62 80 56" fill="none" stroke="url(#eyeInner)" stroke-width="2.2" stroke-linecap="round"/>
            </g>

            <circle cx="38" cy="62" r="1.2" fill="#67E8F9" opacity="0.5"/>
            <circle cx="82" cy="62" r="1.2" fill="#67E8F9" opacity="0.5"/>
          </g>

        </g>
      </svg>
    `;
  }

  // ===== СОЗДАНИЕ =====
  function createMascot() {
    const el = document.createElement('div');
    el.id = MASCOT_ID;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Открыть чат с ИИ-менеджером');
    el.setAttribute('tabindex', '0');
    el.innerHTML = buildRobotSVG();

    // Клик — открываем чат-виджет
    el.addEventListener('click', () => {
      if (typeof window.openChatWidget === 'function') {
        window.openChatWidget();
      } else {
        window.open(TELEGRAM_URL, '_blank', 'noopener');
      }
    });

    // Клавиатура
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (typeof window.openChatWidget === 'function') {
          window.openChatWidget();
        } else {
          window.open(TELEGRAM_URL, '_blank', 'noopener');
        }
      }
    });

    document.body.appendChild(el);
    return el;
  }

  // ===== МОРГАНИЕ ПРИ НАВЕДЕНИИ =====
  function setupBlink(mascot) {
    let blinkTimer = null;

    function blinkOnce() {
      mascot.classList.add('blink');
      setTimeout(() => {
        mascot.classList.remove('blink');
      }, 150);
    }

    mascot.addEventListener('mouseenter', () => {
      blinkOnce();
      blinkTimer = setInterval(blinkOnce, 4000);
    });

    mascot.addEventListener('mouseleave', () => {
      if (blinkTimer) {
        clearInterval(blinkTimer);
        blinkTimer = null;
      }
      blinkOnce();
    });
  }

  // ===== СЛЕЖЕНИЕ ЗА МЫШЬЮ =====
  function setupEyeTracking(mascot) {
    const pupilLeft = mascot.querySelector('.pupil-left');
    const pupilRight = mascot.querySelector('.pupil-right');

    if (!pupilLeft || !pupilRight) return;

    const MAX_SHIFT = 3;

    function handleMouseMove(e) {
      const rect = mascot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      const distance = Math.hypot(dx, dy);

      const ratio = Math.min(distance / 200, 1);
      const shiftX = (dx / (distance || 1)) * MAX_SHIFT * ratio;
      const shiftY = (dy / (distance || 1)) * MAX_SHIFT * ratio;

      pupilLeft.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
      pupilRight.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
    }

    document.addEventListener('mousemove', handleMouseMove);

    if (window.matchMedia('(hover: none)').matches) {
      document.removeEventListener('mousemove', handleMouseMove);
    }
  }

  // ===== ПОКАЗ / СКРЫТИЕ =====
  function updateVisibility(mascot) {
    const scrollTop = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;

    if (progress >= SHOW_THRESHOLD) {
      mascot.classList.add('visible');
    } else {
      mascot.classList.remove('visible');
    }
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init() {
    const mascot = createMascot();

    setupBlink(mascot);
    setupEyeTracking(mascot);

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateVisibility(mascot);
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    updateVisibility(mascot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();