// ============================================
// POST /api/bot/delete-webhook
// VPS-бот удаляет webhook через Telegram API
// Авторизация: X-Bot-Secret
// Body: { client_id, drop_pending }
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, drop_pending } = body;

    if (!client_id) {
      return Response.json({ ok: false, error: 'client_id required' }, { status: 400 });
    }

    const settings = await env.radar_group_db.prepare(
      `SELECT bot_telegram_token FROM settings WHERE client_id = ?`
    ).bind(client_id).first();

    if (!settings || !settings.bot_telegram_token) {
      return Response.json({ ok: false, error: 'Bot token missing' }, { status: 400 });
    }

    const res = await fetch(
      `https://api.telegram.org/bot${settings.bot_telegram_token}/deleteWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_pending_updates: drop_pending === true
        })
      }
    );

    const data = await res.json();

    if (!data.ok) {
      return Response.json({ ok: false, error: data.description || 'Telegram error' }, { status: 500 });
    }

    return Response.json({ ok: true });

  } catch (err) {
    console.error('Bot delete webhook error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}