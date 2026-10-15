// ============================================
// /api/dialogs/:id — один диалог с сообщениями
// ============================================

export async function onRequestGet({ params, request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');

    if (!token) {
      return Response.json(
        { ok: false, error: { ru: 'Не авторизован', en: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const payload = decodeJWT(token);
    if (!payload || !payload.clientId) {
      return Response.json(
        { ok: false, error: { ru: 'Неверный токен', en: 'Invalid token' } },
        { status: 401 }
      );
    }

    const dialog = await env.radar_group_db.prepare(
      `SELECT * FROM dialogs WHERE id = ? AND client_id = ?`
    ).bind(params.id, payload.clientId).first();

    if (!dialog) {
      return Response.json(
        { ok: false, error: { ru: 'Диалог не найден', en: 'Dialog not found' } },
        { status: 404 }
      );
    }

    const { results: messages } = await env.radar_group_db.prepare(
      `SELECT id, role, content, tokens_used, cost_usd, created_at
       FROM messages WHERE dialog_id = ?
       ORDER BY created_at ASC`
    ).bind(params.id).all();

    return Response.json({
      ok: true,
      dialog,
      messages: messages || []
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}