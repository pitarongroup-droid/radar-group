// ============================================
// /api/bot/session — FSM состояния VPS-бота
// GET  ?client_id=&user_uid=   — получить состояние
// POST                         — сохранить состояние
// DELETE ?client_id=&user_uid= — удалить состояние
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
    const userUid = url.searchParams.get('user_uid');

    if (!clientId || !userUid) {
      return Response.json({ ok: false, error: 'client_id and user_uid required' }, { status: 400 });
    }

    const row = await env.radar_group_db.prepare(
      `SELECT * FROM bot_sessions WHERE client_id = ? AND user_uid = ?`
    ).bind(clientId, userUid).first();

    if (!row) {
      return Response.json({ ok: true, session: null });
    }

    let data = {};
    try { data = row.data ? JSON.parse(row.data) : {}; } catch (e) {}

    return Response.json({
      ok: true,
      session: {
        id: row.id,
        client_id: row.client_id,
        user_uid: row.user_uid,
        dialog_id: row.dialog_id,
        state: row.state,
        data,
        updated_at: row.updated_at
      }
    });

  } catch (err) {
    console.error('Session GET error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, user_uid, dialog_id, state, data } = body;

    if (!client_id || !user_uid) {
      return Response.json({ ok: false, error: 'client_id and user_uid required' }, { status: 400 });
    }

    const existing = await env.radar_group_db.prepare(
      `SELECT id FROM bot_sessions WHERE client_id = ? AND user_uid = ?`
    ).bind(client_id, user_uid).first();

    const dataJson = data ? JSON.stringify(data) : null;

    if (existing) {
      await env.radar_group_db.prepare(
        `UPDATE bot_sessions
         SET dialog_id = COALESCE(?, dialog_id),
             state = COALESCE(?, state),
             data = COALESCE(?, data),
             updated_at = unixepoch()
         WHERE id = ?`
      ).bind(
        dialog_id || null,
        state || null,
        dataJson,
        existing.id
      ).run();

      return Response.json({ ok: true, session_id: existing.id, updated: true });
    }

    const sessionId = 'sess_' + crypto.randomUUID().slice(0, 8);

    await env.radar_group_db.prepare(
      `INSERT INTO bot_sessions (id, client_id, user_uid, dialog_id, state, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      client_id,
      user_uid,
      dialog_id || null,
      state || 'idle',
      dataJson
    ).run();

    return Response.json({ ok: true, session_id: sessionId, updated: false });

  } catch (err) {
    console.error('Session POST error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');
    const userUid = url.searchParams.get('user_uid');

    if (!clientId || !userUid) {
      return Response.json({ ok: false, error: 'client_id and user_uid required' }, { status: 400 });
    }

    await env.radar_group_db.prepare(
      `DELETE FROM bot_sessions WHERE client_id = ? AND user_uid = ?`
    ).bind(clientId, userUid).run();

    return Response.json({ ok: true });

  } catch (err) {
    console.error('Session DELETE error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}