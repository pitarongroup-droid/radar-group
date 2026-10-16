// ============================================
// /api/settings — настройки клиента (клиентский уровень)
// Клиент видит только СВОИ каналы + дизайн виджета.
// НЕ видит: ai_api_key, ai_provider, ai_base_url, industry, services, webhook_*
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload) return unauthorized();

    // ⚠️ Клиент видит ТОЛЬКО эти поля:
    const settings = await env.radar_group_db.prepare(
      `SELECT prompt_ru, prompt_en,
              telegram_token, telegram_admin_id,
              notification_email,
              sheets_url,
              widget_color, widget_title_ru, widget_title_en,
              widget_welcome_ru, widget_welcome_en,
              max_daily_requests,
              channel_telegram_enabled,
              channel_sheets_enabled,
              channel_webhook_enabled,
              channel_email_enabled
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

    // ⚠️ Клиент может менять ТОЛЬКО:
    // — промпт
    // — свой Telegram (token + admin_id)
    // — свой email
    // — свой Google Sheets URL
    // — виджет
    // — лимит
    // — вкл/выкл каналов
    // НЕ может: ai_api_key, ai_provider, ai_base_url, industry, services, webhook_*
    await env.radar_group_db.prepare(
      `UPDATE settings SET
         prompt_ru = COALESCE(?, prompt_ru),
         prompt_en = COALESCE(?, prompt_en),
         telegram_token = COALESCE(?, telegram_token),
         telegram_admin_id = COALESCE(?, telegram_admin_id),
         notification_email = COALESCE(?, notification_email),
         sheets_url = COALESCE(?, sheets_url),
         widget_color = COALESCE(?, widget_color),
         widget_title_ru = COALESCE(?, widget_title_ru),
         widget_title_en = COALESCE(?, widget_title_en),
         widget_welcome_ru = COALESCE(?, widget_welcome_ru),
         widget_welcome_en = COALESCE(?, widget_welcome_en),
         max_daily_requests = COALESCE(?, max_daily_requests),
         channel_telegram_enabled = COALESCE(?, channel_telegram_enabled),
         channel_sheets_enabled = COALESCE(?, channel_sheets_enabled),
         channel_webhook_enabled = COALESCE(?, channel_webhook_enabled),
         channel_email_enabled = COALESCE(?, channel_email_enabled),
         updated_at = unixepoch()
       WHERE client_id = ?`
    ).bind(
      b.prompt_ru !== undefined ? b.prompt_ru : null,
      b.prompt_en !== undefined ? b.prompt_en : null,
      b.telegram_token !== undefined ? b.telegram_token : null,
      b.telegram_admin_id !== undefined ? b.telegram_admin_id : null,
      b.notification_email !== undefined ? b.notification_email : null,
      b.sheets_url !== undefined ? b.sheets_url : null,
      b.widget_color !== undefined ? b.widget_color : null,
      b.widget_title_ru !== undefined ? b.widget_title_ru : null,
      b.widget_title_en !== undefined ? b.widget_title_en : null,
      b.widget_welcome_ru !== undefined ? b.widget_welcome_ru : null,
      b.widget_welcome_en !== undefined ? b.widget_welcome_en : null,
      b.max_daily_requests !== undefined ? b.max_daily_requests : null,
      b.channel_telegram_enabled !== undefined ? (b.channel_telegram_enabled ? 1 : 0) : null,
      b.channel_sheets_enabled !== undefined ? (b.channel_sheets_enabled ? 1 : 0) : null,
      b.channel_webhook_enabled !== undefined ? (b.channel_webhook_enabled ? 1 : 0) : null,
      b.channel_email_enabled !== undefined ? (b.channel_email_enabled ? 1 : 0) : null,
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