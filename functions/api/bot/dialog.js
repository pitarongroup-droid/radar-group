// ============================================
// POST /api/bot/dialog — создать / получить диалог
// GET  /api/bot/dialog?id=dlg_xxx — получить диалог + сообщения
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, channel, user_uid, user_name } = body;

    if (!client_id) {
      return Response.json({ ok: false, error: 'client_id required' }, { status: 400 });
    }

    const client = await env.radar_group_db.prepare(
      `SELECT id, account_status FROM clients WHERE id = ?`
    ).bind(client_id).first();

    if (!client) {
      return Response.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    if (client.account_status !== 'approved') {
      return Response.json({ ok: false, error: 'Account not approved' }, { status: 403 });
    }

    if (user_uid) {
      const existing = await env.radar_group_db.prepare(
        `SELECT id FROM dialogs
         WHERE client_id = ? AND user_uid = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`
      ).bind(client_id, user_uid).first();

      if (existing) {
        return Response.json({ ok: true, dialog_id: existing.id, existed: true });
      }
    }

    const dialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);

    await env.radar_group_db.prepare(
      `INSERT INTO dialogs (id, client_id, channel, user_uid, user_name, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).bind(
      dialogId,
      client_id,
      channel || 'telegram',
      user_uid || null,
      user_name || null
    ).run();

    return Response.json({ ok: true, dialog_id: dialogId, existed: false });

  } catch (err) {
    console.error('Bot dialog error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const dialogId = url.searchParams.get('id');

    if (!dialogId) {
      return Response.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const dialog = await env.radar_group_db.prepare(
      `SELECT * FROM dialogs WHERE id = ?`
    ).bind(dialogId).first();

    if (!dialog) {
      return Response.json({ ok: false, error: 'Dialog not found' }, { status: 404 });
    }

    const { results: messages } = await env.radar_group_db.prepare(
      `SELECT id, role, content, created_at FROM messages
       WHERE dialog_id = ? ORDER BY created_at ASC LIMIT 100`
    ).bind(dialogId).all();

    return Response.json({
      ok: true,
      dialog,
      messages: messages || []
    });

  } catch (err) {
    console.error('Bot dialog GET error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}