// ============================================
// POST /api/bot/message — записать сообщение (VPS-бот)
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { dialog_id, client_id, role, content, tokens_used, cost_usd } = body;

    if (!dialog_id || !role || !content) {
      return Response.json({ ok: false, error: 'dialog_id, role, content required' }, { status: 400 });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return Response.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }

    const messageId = 'msg_' + crypto.randomUUID().slice(0, 8);

    await env.radar_group_db.prepare(
      `INSERT INTO messages (id, dialog_id, role, content, tokens_used, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      messageId,
      dialog_id,
      role,
      content,
      tokens_used || 0,
      cost_usd || 0
    ).run();

    await env.radar_group_db.prepare(
      `UPDATE dialogs SET updated_at = unixepoch() WHERE id = ?`
    ).bind(dialog_id).run();

    return Response.json({ ok: true, message_id: messageId });

  } catch (err) {
    console.error('Bot message error:', err);
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