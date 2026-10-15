// ============================================
// POST /api/auth/login — вход
// ============================================

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return error('Заполните все поля', 'Fill all fields');
    }

    const user = await env.radar_group_db.prepare(
      'SELECT id, client_id, email, password_hash, role FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) {
      return error('Неверный email или пароль', 'Invalid email or password', 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return error('Неверный email или пароль', 'Invalid email or password', 401);
    }

    const client = await env.radar_group_db.prepare(
      'SELECT name FROM clients WHERE id = ?'
    ).bind(user.client_id).first();

    await env.radar_group_db.prepare(
      'UPDATE users SET last_login = unixepoch() WHERE id = ?'
    ).bind(user.id).run();

    const token = await createJWT({
      userId: user.id,
      clientId: user.client_id,
      role: user.role,
      name: client?.name || 'Клиент'
    }, env.JWT_SECRET);

    return Response.json({
      ok: true,
      token,
      user: {
        id: user.id,
        clientId: user.client_id,
        email: user.email,
        name: client?.name || 'Клиент',
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return Response.json({
      ok: false,
      error: {
        ru: 'Ошибка входа. Попробуйте позже.',
        en: 'Login error. Please try again later.'
      }
    }, { status: 500 });
  }
}

function error(ru, en, status = 400) {
  return Response.json({ ok: false, error: { ru, en } }, { status });
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

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const computed = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
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