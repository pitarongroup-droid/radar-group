// ============================================
// /api/bot/reminder — управление напоминаниями
// POST   — создать напоминание
// GET    — получить готовые к отправке
// PUT    — пометить отправленным
// DELETE — удалить все для диалога
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, dialog_id, user_uid, stage, delay_seconds } = body;

    if (!client_id || !dialog_id || !user_uid || stage === undefined) {
      return Response.json({ ok: false, error: 'client_id, dialog_id, user_uid, stage required' }, { status: 400 });
    }

    const scheduledAt = Math.floor(Date.now() / 1000) + (delay_seconds || 900);
    const id = 'rem_' + crypto.randomUUID().slice(0, 8);

    await env.radar_group_db.prepare(
      `INSERT INTO bot_reminders (id, client_id, dialog_id, user_uid, stage, scheduled_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(id, client_id, dialog_id, user_uid, stage, scheduledAt).run();

    return Response.json({ ok: true, reminder_id: id, scheduled_at: scheduledAt });

  } catch (err) {
    console.error('Reminder POST error:', err);
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
    const clientId = url.searchParams.get('client_id');
    const now = Math.floor(Date.now() / 1000);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    let query, params;

    if (clientId) {
      query = `SELECT * FROM bot_reminders
               WHERE client_id = ? AND status = 'pending' AND scheduled_at <= ?
               ORDER BY scheduled_at ASC LIMIT ?`;
      params = [clientId, now, limit];
    } else {
      query = `SELECT * FROM bot_reminders
               WHERE status = 'pending' AND scheduled_at <= ?
               ORDER BY scheduled_at ASC LIMIT ?`;
      params = [now, limit];
    }

    const { results } = await env.radar_group_db.prepare(query).bind(...params).all();

    return Response.json({ ok: true, reminders: results || [] });

  } catch (err) {
    console.error('Reminder GET error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { reminder_id, status } = body;

    if (!reminder_id || !status) {
      return Response.json({ ok: false, error: 'reminder_id and status required' }, { status: 400 });
    }

    if (!['sent', 'cancelled', 'failed'].includes(status)) {
      return Response.json({ ok: false, error: 'Invalid status' }, { status: 400 });
    }

    await env.radar_group_db.prepare(
      `UPDATE bot_reminders
       SET status = ?, sent_at = unixepoch()
       WHERE id = ?`
    ).bind(status, reminder_id).run();

    return Response.json({ ok: true });

  } catch (err) {
    console.error('Reminder PUT error:', err);
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
    const dialogId = url.searchParams.get('dialog_id');

    if (!dialogId) {
      return Response.json({ ok: false, error: 'dialog_id required' }, { status: 400 });
    }

    await env.radar_group_db.prepare(
      `UPDATE bot_reminders
       SET status = 'cancelled'
       WHERE dialog_id = ? AND status = 'pending'`
    ).bind(dialogId).run();

    return Response.json({ ok: true });

  } catch (err) {
    console.error('Reminder DELETE error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}