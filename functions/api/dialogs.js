// ============================================
// /api/dialogs — список диалогов клиента
// GET /api/dialogs
// ============================================

export async function onRequestGet({ request, env }) {
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

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    
    // НОВЫЕ ПАРАМЕТРЫ (для фильтров)
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const search = url.searchParams.get('search');

    let query = `SELECT id, channel, user_name, user_contact, status, is_lead, lead_data, created_at
                 FROM dialogs WHERE client_id = ?`;
    const params = [payload.clientId];

    // 1. Существующая логика табов
    if (filter === 'leads') {
      query += ` AND is_lead = 1`;
    } else if (filter === 'active') {
      query += ` AND status = 'active'`;
    } else if (filter === 'closed') {
      query += ` AND status = 'closed'`;
    }

    // 2. НОВЫЙ ФИЛЬТР ПО ДАТЕ (С / По)
    if (dateFrom) {
      const fromTimestamp = Math.floor(new Date(dateFrom).getTime() / 1000);
      query += ` AND created_at >= ?`;
      params.push(fromTimestamp);
    }
    if (dateTo) {
      const toTimestamp = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);
      query += ` AND created_at <= ?`;
      params.push(toTimestamp);
    }

    // 3. НОВЫЙ ТЕКСТОВЫЙ ПОИСК
    if (search) {
      query += ` AND (user_name LIKE ? OR user_contact LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const { results } = await env.radar_group_db.prepare(query).bind(...params).all();

    // Сохранен подсчет сообщений
    const dialogs = await Promise.all((results || []).map(async (d) => {
      const msgCount = await env.radar_group_db.prepare(
        `SELECT COUNT(*) as c FROM messages WHERE dialog_id = ?`
      ).bind(d.id).first();

      return {
        ...d,
        messages_count: msgCount.c || 0
      };
    }));

    return Response.json({ ok: true, dialogs });
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