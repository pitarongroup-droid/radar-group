// ============================================
// /api/admin/clients — список и создание клиентов
// ⚠️ Проверяет role = admin
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const { results } = await env.radar_group_db.prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id) as dialogs_count,
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id AND is_lead = 1) as leads_count
       FROM clients c
       ORDER BY c.created_at DESC`
    ).all();

    return Response.json({ ok: true, clients: results });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const b = await request.json();

    if (!b.name || !b.email) {
      return Response.json(
        { ok: false, error: { ru: 'Имя и email обязательны', en: 'Name and email required' } },
        { status: 400 }
      );
    }

    const existing = await env.radar_group_db.prepare(
      'SELECT id FROM clients WHERE email = ?'
    ).bind(b.email.toLowerCase()).first();

    if (existing) {
      return Response.json(
        { ok: false, error: { ru: 'Клиент с таким email уже существует', en: 'Client with this email already exists' } },
        { status: 400 }
      );
    }

    const id = 'cli_' + crypto.randomUUID().slice(0, 8);
    const apiKey = 'rg_live_' + generateKey(32);

    await env.radar_group_db.batch([
      env.radar_group_db.prepare(
        `INSERT INTO clients
         (id, name, email, phone, company, site_url, language, currency,
          api_key, plan, status, account_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'pending')`
      ).bind(
        id,
        b.name,
        b.email.toLowerCase(),
        b.phone || null,
        b.company || null,
        b.site_url || null,
        b.language || 'ru',
        b.currency || 'USD',
        apiKey,
        b.plan || 'basic'
      ),
      env.radar_group_db.prepare(
        `INSERT INTO settings (client_id, widget_enabled, bot_enabled)
         VALUES (?, 0, 0)`
      ).bind(id)
    ]);

    // Авто-уведомление VPS (на случай, если bot_enabled=1 уже)
    try {
      if (env.VPS_RELOAD_URL && env.BOT_SECRET) {
        await fetch(env.VPS_RELOAD_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Secret': env.BOT_SECRET
          },
          body: JSON.stringify({ client_id: id, action: 'created' })
        }).catch(() => {});
      }
    } catch (e) {
      console.error('VPS notify error:', e);
    }

    return Response.json({
      ok: true,
      id,
      api_key: apiKey,
      account_status: 'pending',
      widget_enabled: 0,
      bot_enabled: 0
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

function getPayload(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch (e) {
    return null;
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