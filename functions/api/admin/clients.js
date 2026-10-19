export async function onRequestGet({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') return Response.json({ ok: false, error: { ru: 'Доступ запрещён' } }, { status: 403 });

    const { results } = await env.radar_group_db.prepare(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id) as dialogs_count,
        (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id AND is_lead = 1) as leads_count
       FROM clients c ORDER BY c.created_at DESC`
    ).all();

    return Response.json({ ok: true, clients: results });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') return Response.json({ ok: false, error: { ru: 'Доступ запрещён' } }, { status: 403 });

    const b = await request.json();
    if (!b.name || !b.email) return Response.json({ ok: false, error: { ru: 'Имя и email обязательны' } }, { status: 400 });

    const existing = await env.radar_group_db.prepare('SELECT id FROM clients WHERE email = ?').bind(b.email.toLowerCase()).first();
    if (existing) return Response.json({ ok: false, error: { ru: 'Email уже занят' } }, { status: 400 });

    const id = 'cli_' + crypto.randomUUID().slice(0, 8);
    const apiKey = 'rg_live_' + generateKey(32);

    // ИСПРАВЛЕНО: используем новые поля для тарифов
    await env.radar_group_db.batch([
      env.radar_group_db.prepare(
        `INSERT INTO clients
         (id, name, email, phone, company, api_key, account_status, 
          tariff_code, monthly_price, sub_currency, subscription_end, next_payment_due, admin_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, b.name, b.email.toLowerCase(), b.phone || null, b.company || null, apiKey, b.account_status || 'pending',
        b.tariff_code || 'start', b.monthly_price || 200, b.sub_currency || 'BYN', b.subscription_end || null, b.next_payment_due || null, b.admin_notes || ''
      ),
      env.radar_group_db.prepare(
        `INSERT INTO settings (client_id, widget_enabled, bot_enabled) VALUES (?, ?, ?)`
      ).bind(id, b.widget_enabled ? 1 : 0, b.bot_enabled ? 1 : 0)
    ]);

    return Response.json({ ok: true, client_id: id, api_key: apiKey });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
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
  } catch (e) { return null; }
}

function generateKey(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  const arr = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) key += chars[arr[i] % chars.length];
  return key;
}