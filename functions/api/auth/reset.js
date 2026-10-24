export async function onRequestPost({ request, env }) {
  try {
    const { token, password } = await request.json();
    if (!token || !password || password.length < 8) {
      return Response.json({ ok: false, error: { ru: 'Неверные данные (пароль от 8 символов)' } }, { status: 400 });
    }

    const now = Date.now();
    
    // Ищем пользователя по токену
    const user = await env.radar_group_db.prepare(
      `SELECT id FROM users WHERE reset_token = ? AND reset_expires > ?`
    ).bind(token, now).first();

    if (!user) {
      return Response.json({ ok: false, error: { ru: 'Ссылка устарела или недействительна' } }, { status: 400 });
    }

    // Хэшируем пароль (скопировано из твоего register.js)
    const passwordHash = await hashPassword(password);

    await env.radar_group_db.prepare(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?`
    ).bind(passwordHash, user.id).run();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}

// Функция хэширования (идентична твоей из register.js)
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