// ============================================
// /api/admin/partners — управление партнерами
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    // Простейшая проверка (в реальном проекте нужно проверять токен админа)
    const auth = request.headers.get('Authorization') || '';
    if (!auth) return Response.json({ ok: false, error: 'Нет доступа' }, { status: 401 });

    // Получаем партнеров + считаем их клиентов и баланс
    const { results } = await env.radar_group_db.prepare(
      `SELECT p.id, p.name, p.email, p.ref_code, p.created_at,
              (SELECT COUNT(*) FROM clients WHERE referred_by = p.id) as clients_count,
              (SELECT COALESCE(SUM(commission_amount), 0) FROM commissions WHERE partner_id = p.id AND status = 'pending') as pending_balance,
              (SELECT COALESCE(SUM(commission_amount), 0) FROM commissions WHERE partner_id = p.id AND status = 'paid') as total_paid
       FROM partners p
       ORDER BY p.created_at DESC`
    ).all();

    return Response.json({ ok: true, partners: results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password, ref_code } = await request.json();

    if (!name || !email || !password || !ref_code) {
      return Response.json({ ok: false, error: 'Заполните все поля' }, { status: 400 });
    }

    // Проверяем, нет ли уже такого email или реф-кода
    const existing = await env.radar_group_db.prepare(
      'SELECT id FROM partners WHERE email = ? OR ref_code = ?'
    ).bind(email.toLowerCase(), ref_code.toLowerCase()).first();

    if (existing) {
      return Response.json({ ok: false, error: 'Партнер с таким email или кодом уже существует' }, { status: 400 });
    }

    const partnerId = 'prt_' + crypto.randomUUID().slice(0, 8);
    const passwordHash = await hashPassword(password); // Хешируем пароль

    await env.radar_group_db.prepare(
      `INSERT INTO partners (id, name, email, ref_code, password_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(partnerId, name, email.toLowerCase(), ref_code.toLowerCase(), passwordHash).run();

    return Response.json({ ok: true, partner_id: partnerId });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Вспомогательная функция хеширования (как в register.js)
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