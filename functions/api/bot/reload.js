// ============================================
// POST /api/bot/reload
// SaaS → VPS: сигнал "перезагрузи бота клиента"
// Авторизация: X-Bot-Secret
// Body: { client_id }
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id } = body;

    if (!client_id) {
      return Response.json({ ok: false, error: 'client_id required' }, { status: 400 });
    }

    const VPS_RELOAD_URL = env.VPS_RELOAD_URL;
    if (!VPS_RELOAD_URL) {
      return Response.json({ ok: false, error: 'VPS_RELOAD_URL not set' }, { status: 500 });
    }

    const res = await fetch(VPS_RELOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': env.BOT_SECRET
      },
      body: JSON.stringify({ client_id })
    });

    const data = await res.json().catch(() => ({}));

    return Response.json({
      ok: res.ok,
      forwarded: true,
      vps_response: data
    });

  } catch (err) {
    console.error('Bot reload error:', err);
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