// ============================================
// /api/admin/settings — полные настройки клиента (для АДМИНА)
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

    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');

    if (!clientId) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    const settings = await env.radar_group_db.prepare(
      'SELECT * FROM settings WHERE client_id = ?'
    ).bind(clientId).first();

    return Response.json({ ok: true, settings: settings || {} });
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
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const b = await request.json();

    if (!b.client_id) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    await env.radar_group_db.prepare(
      `INSERT INTO settings
       (client_id,
        prompt_ru, prompt_en,
        ai_provider, ai_api_key, ai_base_url,
        industry, services,
        telegram_token, telegram_admin_id,
        widget_color, widget_title_ru, widget_title_en,
        widget_welcome_ru, widget_welcome_en,
        sheets_url,
        webhook_url, webhook_secret,
        notification_email, max_daily_requests,
        channel_telegram_enabled, channel_sheets_enabled,
        channel_webhook_enabled, channel_email_enabled,
        admin_allow_telegram, admin_allow_sheets,
        admin_allow_webhook, admin_allow_email,
        updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(client_id) DO UPDATE SET
         prompt_ru = excluded.prompt_ru,
         prompt_en = excluded.prompt_en,
         ai_provider = excluded.ai_provider,
         ai_api_key = excluded.ai_api_key,
         ai_base_url = excluded.ai_base_url,
         industry = excluded.industry,
         services = excluded.services,
         telegram_token = excluded.telegram_token,
         telegram_admin_id = excluded.telegram_admin_id,
         widget_color = excluded.widget_color,
         widget_title_ru = excluded.widget_title_ru,
         widget_title_en = excluded.widget_title_en,
         widget_welcome_ru = excluded.widget_welcome_ru,
         widget_welcome_en = excluded.widget_welcome_en,
         sheets_url = excluded.sheets_url,
         webhook_url = excluded.webhook_url,
         webhook_secret = excluded.webhook_secret,
         notification_email = excluded.notification_email,
         max_daily_requests = excluded.max_daily_requests,
         channel_telegram_enabled = excluded.channel_telegram_enabled,
         channel_sheets_enabled = excluded.channel_sheets_enabled,
         channel_webhook_enabled = excluded.channel_webhook_enabled,
         channel_email_enabled = excluded.channel_email_enabled,
         admin_allow_telegram = excluded.admin_allow_telegram,
         admin_allow_sheets = excluded.admin_allow_sheets,
         admin_allow_webhook = excluded.admin_allow_webhook,
         admin_allow_email = excluded.admin_allow_email,
         updated_at = unixepoch()`
    ).bind(
      b.client_id,
      b.prompt_ru || null,
      b.prompt_en || null,
      b.ai_provider || 'proxyapi',
      b.ai_api_key || null,
      b.ai_base_url || null,
      b.industry || 'other',
      b.services || null,
      b.telegram_token || null,
      b.telegram_admin_id || null,
      b.widget_color || '#00F0FF',
      b.widget_title_ru || 'ИИ-менеджер',
      b.widget_title_en || 'AI Manager',
      b.widget_welcome_ru || 'Здравствуйте! Чем помочь?',
      b.widget_welcome_en || 'Hello! How can I help?',
      b.sheets_url || null,
      b.webhook_url || null,
      b.webhook_secret || null,
      b.notification_email || null,
      b.max_daily_requests || 1000,
      b.channel_telegram_enabled !== undefined ? (b.channel_telegram_enabled ? 1 : 0) : 1,
      b.channel_sheets_enabled ? 1 : 0,
      b.channel_webhook_enabled ? 1 : 0,
      b.channel_email_enabled ? 1 : 0,
      b.admin_allow_telegram !== undefined ? (b.admin_allow_telegram ? 1 : 0) : 1,
      b.admin_allow_sheets !== undefined ? (b.admin_allow_sheets ? 1 : 0) : 1,
      b.admin_allow_webhook !== undefined ? (b.admin_allow_webhook ? 1 : 0) : 1,
      b.admin_allow_email !== undefined ? (b.admin_allow_email ? 1 : 0) : 1
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