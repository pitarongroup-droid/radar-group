// ============================================
// POST /api/bot/events — лог событий от VPS-бота
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, event_name, dialog_id, metadata } = body;

    if (!client_id || !event_name) {
      return Response.json({ ok: false, error: 'client_id and event_name required' }, { status: 400 });
    }

    const eventId = 'evt_' + crypto.randomUUID().slice(0, 8);

    await env.radar_group_db.prepare(
      `INSERT INTO events (id, client_id, event_name, dialog_id, metadata)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      client_id,
      event_name,
      dialog_id || null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    return Response.json({ ok: true, event_id: eventId });

  } catch (err) {
    console.error('Bot events error:', err);
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