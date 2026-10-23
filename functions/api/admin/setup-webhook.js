// ============================================
// POST /api/admin/setup-webhook
// Автоматически ставит Telegram webhook на VPS для бота клиента
// ⚠️ Проверяет role = admin
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const { client_id } = await request.json();

    if (!client_id) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    const settings = await env.radar_group_db.prepare(
      `SELECT bot_telegram_token FROM settings WHERE client_id = ?`
    ).bind(client_id).first();

    if (!settings || !settings.bot_telegram_token) {
      return Response.json(
        { ok: false, error: { ru: 'Токен бота не указан', en: 'Bot token missing' } },
        { status: 400 }
      );
    }

    const BOT_HOST = env.BOT_HOST;
    if (!BOT_HOST) {
      return Response.json(
        { ok: false, error: { ru: 'BOT_HOST не задан в env', en: 'BOT_HOST missing' } },
        { status: 500 }
      );
    }

    const webhookUrl = `${BOT_HOST}/tg/${client_id}`;

    const res = await fetch(
      `https://api.telegram.org/bot${settings.bot_telegram_token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query', 'business_connection', 'business_message', 'edited_business_message']
        })
      }
    );

    const data = await res.json();

    if (!data.ok) {
      return Response.json(
        { ok: false, error: { ru: data.description || 'Ошибка Telegram', en: data.description || 'Telegram error' } },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, webhook_url: webhookUrl });

  } catch (err) {
    console.error('Setup webhook error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
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