// ============================================
// /api/admin/clients — список и создание клиентов
// ============================================

// GET — список всех клиентов
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.radar_group_db.prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id) as dialogs_count,
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id AND is_lead = 1) as leads_count
       FROM clients c
       ORDER BY c.created_at DESC`
    ).all();
    return Response.json({ ok: true, clients: results });
  } catch (err) {
    console.error('Admin clients GET error:', err);
    return Response.json(
      { ok: false, error: { ru: 'Ошибка загрузки', en: 'Load error' } },
      { status: 500 }
    );
  }
}

// POST — создать клиента
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();

    if (!b.name || !b.email) {
      return Response.json(
        { ok: false, error: { ru: 'Имя и email обязательны', en: 'Name and email required' } },
        { status: 400 }
      );
    }

    const id = 'cli_' + crypto.randomUUID().slice(0, 8);
    const apiKey = 'rg_live_' + generateKey(32);

    await env.radar_group_db.batch([
      env.radar_group_db.prepare(
        `INSERT INTO clients
         (id, name, email, phone, company, site_url, language, currency, api_key, plan, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).bind(
        id, b.name, b.email.toLowerCase(),
        b.phone || null, b.company || null, b.site_url || null,
        b.language || 'ru', b.currency || 'USD',
        apiKey, b.plan || 'basic'
      ),
      env.radar_group_db.prepare(
        `INSERT INTO settings (client_id) VALUES (?)`
      ).bind(id)
    ]);

    return Response.json({ ok: true, id, api_key: apiKey });
  } catch (err) {
    console.error('Admin clients POST error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
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