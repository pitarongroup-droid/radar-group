// ============================================
// GET /api/bot/config?client_id=cli_xxx
// Получить ВСЁ что нужно VPS для работы одного бота
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');

    if (!clientId) {
      return Response.json({ ok: false, error: 'client_id required' }, { status: 400 });
    }

    const client = await env.radar_group_db.prepare(
      `SELECT id, name, account_status FROM clients WHERE id = ?`
    ).bind(clientId).first();

    if (!client) {
      return Response.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    if (client.account_status !== 'approved') {
      return Response.json({ ok: false, error: 'Account not approved' }, { status: 403 });
    }

    const s = await env.radar_group_db.prepare(
      `SELECT * FROM settings WHERE client_id = ?`
    ).bind(clientId).first();

    if (!s || s.bot_enabled !== 1) {
      return Response.json({ ok: false, error: 'Bot disabled' }, { status: 403 });
    }

    return Response.json({
      ok: true,
      config: {
        client_id: client.id,
        client_name: client.name,

        // Telegram
        telegram_token: s.bot_telegram_token,
        telegram_admin_id: s.bot_telegram_admin_id,

        // Промпты и приветствие
        prompt_ru: s.bot_prompt_ru,
        prompt_en: s.bot_prompt_en,
        greeting_ru: s.bot_greeting_ru,

        // AI
        ai_provider: s.bot_ai_provider || 'proxyapi',
        ai_api_key: s.bot_ai_api_key,
        ai_base_url: s.bot_ai_base_url,

        // Бизнес
        industry: s.bot_industry,
        services: s.bot_services,

        // Работа
        work_hours: s.bot_work_hours || 'always',
        reminders_enabled: s.bot_reminders_enabled === 1,
        max_daily: s.bot_max_daily || 1000,

        // Каналы
        channel_telegram_enabled: s.bot_channel_telegram_enabled === 1,
        channel_sheets_enabled: s.bot_channel_sheets_enabled === 1,
        channel_webhook_enabled: s.bot_channel_webhook_enabled === 1,
        channel_email_enabled: s.bot_channel_email_enabled === 1,

        sheets_url: s.bot_sheets_url,
        webhook_url: s.bot_webhook_url,
        webhook_secret: s.bot_webhook_secret,
        notification_email: s.bot_notification_email,

        // Telegram Business
        business_bot_enabled: s.business_bot_enabled === 1,
        business_connection_id: s.business_connection_id
      }
    });

  } catch (err) {
    console.error('Bot config error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}