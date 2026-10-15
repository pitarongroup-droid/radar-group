// ============================================
// /api/admin/settings — токены и настройки клиента
// Здесь сохраняются: OpenAI key, Telegram token,
// промпты RU/EN, виджет, webhook
// ============================================

// GET /api/admin/settings?client_id=cli_xxx
export async function onRequestGet({ request, env }) {
  try {
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
    console.error('Settings GET error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings — сохранить настройки клиента
export async function onRequestPut({ request, env }) {
  try {
    const b = await request.json();

    if (!b.client_id) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    await env.radar_group_db.prepare(
      `INSERT INTO settings
       (client_id, prompt_ru, prompt_en, openai_api_key, telegram_token,
        telegram_admin_id, widget_color, widget_title_ru, widget_title_en,
        widget_welcome_ru, widget_welcome_en, webhook_url, webhook_secret,
        notification_email, max_daily_requests, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(client_id) DO UPDATE SET
         prompt_ru = excluded.prompt_ru,
         prompt_en = excluded.prompt_en,
         openai_api_key = excluded.openai_api_key,
         telegram_token = excluded.telegram_token,
         telegram_admin_id = excluded.telegram_admin_id,
         widget_color = excluded.widget_color,
         widget_title_ru = excluded.widget_title_ru,
         widget_title_en = excluded.widget_title_en,
         widget_welcome_ru = excluded.widget_welcome_ru,
         widget_welcome_en = excluded.widget_welcome_en,
         webhook_url = excluded.webhook_url,
         webhook_secret = excluded.webhook_secret,
         notification_email = excluded.notification_email,
         max_daily_requests = excluded.max_daily_requests,
         updated_at = unixepoch()`
    ).bind(
      b.client_id,
      b.prompt_ru || null,
      b.prompt_en || null,
      b.openai_api_key || null,
      b.telegram_token || null,
      b.telegram_admin_id || null,
      b.widget_color || '#00F0FF',
      b.widget_title_ru || 'ИИ-менеджер',
      b.widget_title_en || 'AI Manager',
      b.widget_welcome_ru || 'Здравствуйте! Чем помочь?',
      b.widget_welcome_en || 'Hello! How can I help?',
      b.webhook_url || null,
      b.webhook_secret || null,
      b.notification_email || null,
      b.max_daily_requests || 1000
    ).run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Settings PUT error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}