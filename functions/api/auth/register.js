// ============================================
// POST /api/auth/register — регистрация клиента
// Новый клиент создаётся с account_status = 'pending'
// ============================================

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // ДОБАВЛЕНО: читаем ref_code из запроса
    const { name, company, email, password, ref_code } = await request.json();

    if (!name || name.length < 2) {
      return error('Укажите ваше имя', 'Please enter your name');
    }
    if (!email || !email.includes('@')) {
      return error('Неверный email', 'Invalid email');
    }
    if (!password || password.length < 8) {
      return error('Пароль минимум 8 символов', 'Password must be at least 8 characters');
    }

    const existing = await env.radar_group_db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) {
      return error('Email уже зарегистрирован', 'Email already registered');
    }

    // ДОБАВЛЕНО: Ищем партнера по реф-коду
    let referredBy = null;
    if (ref_code) {
      const partner = await env.radar_group_db.prepare(
        'SELECT id FROM partners WHERE ref_code = ?'
      ).bind(ref_code).first();
      
      if (partner) {
        referredBy = partner.id;
      }
    }

    const clientId = 'cli_' + crypto.randomUUID().slice(0, 8);
    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const apiKey = 'rg_live_' + generateKey(32);

    const passwordHash = await hashPassword(password);

    await env.radar_group_db.batch([
      // ИЗМЕНЕНО: Добавлена колонка referred_by
      env.radar_group_db.prepare(
        `INSERT INTO clients 
         (id, name, email, company, api_key, account_status, referred_by) 
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(clientId, name, email.toLowerCase(), company || null, apiKey, referredBy),

      env.radar_group_db.prepare(
        `INSERT INTO users 
         (id, client_id, email, password_hash, role) 
         VALUES (?, ?, ?, ?, ?)`
      ).bind(userId, clientId, email.toLowerCase(), passwordHash, 'client'),

      env.radar_group_db.prepare(
        `INSERT INTO settings 
         (client_id, widget_enabled, bot_enabled) 
         VALUES (?, 0, 0)`
      ).bind(clientId)
    ]);

    // ============================================
    // 🔥 ОТПРАВКА УВЕДОМЛЕНИЯ В TELEGRAM (АДМИНУ)
    // ============================================
    try {
      const adminTgToken = env.BOT_TOKEN;
      const adminChatId = env.CHAT_ID;
      
      if (adminTgToken && adminChatId) {
        const ip = request.headers.get('cf-connecting-ip') || 'неизвестен';
        
        const safeName = escapeHtml(name);
        const safeCompany = escapeHtml(company || '—');
        const safeEmail = escapeHtml(email);
        
        const text = 
          `🔥 <b>НОВАЯ РЕГИСТРАЦИЯ</b>\n\n` +
          `👤 <b>Имя:</b> ${safeName}\n` +
          `🏢 <b>Компания:</b> ${safeCompany}\n` +
          `📧 <b>Email:</b> ${safeEmail}\n` +
          `🆔 <b>ID:</b> <code>${clientId}</code>\n` +
          (referredBy ? `🤝 <b>Пришел от партнера:</b> <code>${referredBy}</code>\n` : '') +
          `🌐 <b>IP:</b> ${ip}\n` +
          `🕐 ${new Date().toLocaleString('ru-RU')}`;

        await fetch(`https://api.telegram.org/bot${adminTgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: adminChatId, 
            text: text, 
            parse_mode: 'HTML' 
          })
        });
      }
    } catch (tgErr) {
      console.error('Failed to send registration notification:', tgErr);
    }

    const token = await createJWT({
      userId,
      clientId,
      role: 'client',
      name
    }, env.JWT_SECRET);

    return Response.json({
      ok: true,
      token,
      user: { id: userId, clientId, email, name, role: 'client' },
      apiKey
    });

  } catch (err) {
    console.error('Register error:', err);
    return Response.json({
      ok: false,
      error: {
        ru: 'Ошибка регистрации. Попробуйте позже.',
        en: 'Registration error. Please try again later.'
      }
    }, { status: 500 });
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function error(ru, en, status = 400) {
  return Response.json({ ok: false, error: { ru, en } }, { status });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateKey(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  const arr = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    key += chars[arr[i] % chars.length];
  }
  return key;
}

function base64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  }));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const signatureBytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureBytes.length; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  const encodedSignature = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${data}.${encodedSignature}`;
}