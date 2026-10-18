// ============================================
// POST /api/bot/business-connection
// Сохраняет business_connection_id в базу
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { client_id, connection_id } = await request.json();

    if (!client_id) {
      return Response.json({ ok: false, error: 'client_id required' }, { status: 400 });
    }

    // Если connection_id пустой — значит, подключение отключено
    const enabled = connection_id ? 1 : 0;

    await env.radar_group_db.prepare(
      `UPDATE settings 
       SET business_connection_id = ?, business_bot_enabled = ? 
       WHERE client_id = ?`
    ).bind(connection_id || null, enabled, client_id).run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Business connection error:', err);
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