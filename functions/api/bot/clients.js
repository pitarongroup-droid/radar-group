// ============================================
// GET /api/bot/clients — список клиентов с включённым ботом
// Для VPS-сервера (aiogram)
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { results } = await env.radar_group_db.prepare(
      `SELECT
         c.id              AS client_id,
         c.name            AS client_name,
         c.account_status,
         s.bot_enabled,
         s.bot_telegram_token,
         s.bot_telegram_admin_id,
         s.bot_prompt_ru,
         s.bot_prompt_en,
         s.bot_ai_provider,
         s.bot_ai_api_key,
         s.bot_ai_base_url,
         s.bot_industry,
         s.bot_services,
         s.bot_work_hours,
         s.bot_reminders_enabled,
         s.bot_max_daily
       FROM clients c
       JOIN settings s ON s.client_id = c.id
       WHERE c.account_status = 'approved'
         AND s.bot_enabled = 1
         AND s.bot_telegram_token IS NOT NULL
         AND s.bot_telegram_token != ''`
    ).all();

    const clients = (results || []).map(c => ({
      client_id: c.client_id,
      client_name: c.client_name,
      telegram_token: c.bot_telegram_token,
      telegram_admin_id: c.bot_telegram_admin_id,
      prompt_ru: c.bot_prompt_ru,
      prompt_en: c.bot_prompt_en,
      ai_provider: c.bot_ai_provider || 'proxyapi',
      ai_api_key: c.bot_ai_api_key,
      ai_base_url: c.bot_ai_base_url,
      industry: c.bot_industry,
      services: c.bot_services,
      work_hours: c.bot_work_hours || 'always',
      reminders_enabled: c.bot_reminders_enabled === 1,
      max_daily: c.bot_max_daily || 1000
    }));

    return Response.json({
      ok: true,
      count: clients.length,
      clients
    });

  } catch (err) {
    console.error('Bot clients error:', err);
    return Response.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
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