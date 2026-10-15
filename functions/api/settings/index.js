// ============================================
// /api/settings — настройки клиента (для кабинета)
// GET  /api/settings — получить свои настройки
// PUT  /api/settings — сохранить
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload) return unauthorized();

    const settings = await env.radar_group_db.prepare(
      `SELECT prompt_ru, prompt_en, openai_api_key, telegram_token,
              telegram_admin_id, widget_color, widget_title_ru, widget_title_en,
              widget_welcome_ru, widget_welcome_en, notification_email,
              webhook_url, max_daily_requests
       FROM settings WHERE client_id = ?`
    ).bind(payload.clientId).first();

    const client = await env.radar_group_db.prepare(
      `SELECT id, name, email, company, site_url, api_key, plan, language, currency
       FROM clients WHERE id = ?`
    ).bind(payload.clientId).first();

    return Response.json({
      ok: true,
      settings: settings || {},
      client: client || {}
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload) return unauthorized();

    const b = await request.json();

    await env.radar_group_db.prepare(
      `UPDATE settings SET
         prompt_ru = COALESCE(?, prompt_ru),
         prompt_en = COALESCE(?, prompt_en),
         widget_color = COALESCE(?, widget_color),
         widget_title_ru = COALESCE(?, widget_title_ru),
         widget_title_en = COALESCE(?, widget_title_en),
         widget_welcome_ru = COALESCE(?, widget_welcome_ru),
         widget_welcome_en = COALESCE(?, widget_welcome_en),
         notification_email = COALESCE(?, notification_email),
         updated_at = unixepoch()
       WHERE client_id = ?`
    ).bind(
      b.prompt_ru || null,
      b.prompt_en || null,
      b.widget_color || null,
      b.widget_title_ru || null,
      b.widget_title_en || null,
      b.widget_welcome_ru || null,
      b.widget_welcome_en || null,
      b.notification_email || null,
      payload.clientId
    ).run();

    return Response.json({ ok: true });
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

function unauthorized() {
  return Response.json(
    { ok: false, error: { ru: 'Не авторизован', en: 'Unauthorized' } },
    { status: 401 }
  );
}