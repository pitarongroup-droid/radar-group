// ============================================
// POST /api/admin/impersonate
// Вход в кабинет клиента (только для админа)
// Body: { client_id }
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    // 1. Проверяем, что запрос от админа
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json({ ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } }, { status: 403 });
    }

    const { client_id } = await request.json();
    if (!client_id) {
      return Response.json({ ok: false, error: { ru: 'Нет client_id', en: 'client_id required' } }, { status: 400 });
    }

    // 2. Получаем данные клиента и его юзера
    const client = await env.radar_group_db.prepare(
      'SELECT id, name, email, account_status FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({ ok: false, error: { ru: 'Клиент не найден', en: 'Client not found' } }, { status: 404 });
    }

    const user = await env.radar_group_db.prepare(
      'SELECT id, email, role FROM users WHERE client_id = ?'
    ).bind(client_id).first();

    // 3. Генерируем JWT-токен для клиента (используя ваш JWT_SECRET)
    const tokenPayload = {
      userId: user ? user.id : null,
      clientId: client.id,
      role: 'client',
      name: client.name || 'Клиент',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2 // Токен живет 2 часа
    };

    const token = await createJWT(tokenPayload, env.JWT_SECRET);

    // 4. Возвращаем токен и данные клиента
    return Response.json({
      ok: true,
      token,
      user: {
        id: user ? user.id : null,
        clientId: client.id,
        email: client.email,
        name: client.name || 'Клиент',
        role: 'client'
      }
    });

  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message, en: err.message } }, { status: 500 });
  }
}

// --- Вспомогательные функции для JWT ---
function getPayload(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch (e) { return null; }
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
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
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
  const encodedSignature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${encodedSignature}`;
}