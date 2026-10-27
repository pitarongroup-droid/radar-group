// ============================================
// POST /api/auth/partner-login — вход партнера
// ============================================

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ ok: false, error: { ru: 'Заполните все поля', en: 'Fill all fields' } }, { status: 400 });
    }

    // Ищем партнера по email
    const partner = await env.radar_group_db.prepare(
      'SELECT id, name, email, password_hash, ref_code FROM partners WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!partner) {
      return Response.json({ ok: false, error: { ru: 'Партнер не найден', en: 'Partner not found' } }, { status: 401 });
    }

    if (!partner.password_hash) {
      return Response.json({ ok: false, error: { ru: 'Пароль не установлен. Обратитесь к админу.', en: 'Password not set. Contact admin.' } }, { status: 401 });
    }

    // Проверяем пароль (PBKDF2)
    const isValid = await verifyPassword(password, partner.password_hash);
    if (!isValid) {
      return Response.json({ ok: false, error: { ru: 'Неверный пароль', en: 'Wrong password' } }, { status: 401 });
    }

    // Создаем токен для партнера
    const token = await createJWT({
      partnerId: partner.id,
      role: 'partner',
      name: partner.name
    }, env.JWT_SECRET);

    return Response.json({
      ok: true,
      token,
      user: { id: partner.id, name: partner.name, email: partner.email, role: 'partner', ref_code: partner.ref_code }
    });

  } catch (err) {
    console.error('Partner login error:', err);
    return Response.json({ ok: false, error: { ru: 'Ошибка сервера', en: 'Server error' } }, { status: 500 });
  }
}

// --- Вспомогательные функции ---

async function verifyPassword(password, storedHash) {
  const [saltHex, originalHashHex] = storedHash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === originalHashHex;
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