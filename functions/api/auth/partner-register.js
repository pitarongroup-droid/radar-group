// ============================================
// POST /api/auth/partner-register — регистрация партнера
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password, ref_code } = await request.json();

    // 1. Валидация
    if (!name || name.length < 2) {
      return Response.json({ ok: false, error: { ru: 'Укажите имя' } }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return Response.json({ ok: false, error: { ru: 'Неверный email' } }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return Response.json({ ok: false, error: { ru: 'Пароль минимум 8 символов' } }, { status: 400 });
    }
    if (!ref_code || !/^[a-zA-Z0-9_-]+$/.test(ref_code)) {
      return Response.json({ ok: false, error: { ru: 'Реф-код должен содержать только латиницу, цифры, дефис или нижнее подчеркивание' } }, { status: 400 });
    }

    // 2. Проверяем, не занят ли email или реф-код
    const existing = await env.radar_group_db.prepare(
      'SELECT id FROM partners WHERE email = ? OR ref_code = ?'
    ).bind(email.toLowerCase(), ref_code.toLowerCase()).first();

    if (existing) {
      return Response.json({ ok: false, error: { ru: 'Партнер с таким Email или реф-кодом уже существует' } }, { status: 400 });
    }

    // 3. Создаем партнера
    const partnerId = 'prt_' + crypto.randomUUID().slice(0, 8);
    const passwordHash = await hashPassword(password);

    await env.radar_group_db.prepare(
      `INSERT INTO partners (id, name, email, ref_code, password_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(partnerId, name, email.toLowerCase(), ref_code.toLowerCase(), passwordHash).run();

    // 4. Сразу создаем токен, чтобы партнеру не пришлось логиниться заново
    const token = await createJWT({
      partnerId: partnerId,
      role: 'partner',
      name: name
    }, env.JWT_SECRET);

    return Response.json({
      ok: true,
      token,
      user: { id: partnerId, name: name, email: email.toLowerCase(), role: 'partner', ref_code: ref_code.toLowerCase() }
    });

  } catch (err) {
    console.error('Partner register error:', err);
    return Response.json({ ok: false, error: { ru: 'Ошибка сервера' } }, { status: 500 });
  }
}

// ============================================
// Вспомогательные функции (хеширование и JWT)
// ============================================

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

function base64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  return `${data}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}