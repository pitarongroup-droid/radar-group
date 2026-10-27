// ============================================
// /api/admin/logs — логи событий (Админ)
// GET /api/admin/logs
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    
    // Новые параметры
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    // Базовый запрос (сохранен твой LEFT JOIN)
    let query = `SELECT e.id, e.event_name as level, e.event_name as message, 
                        c.name as source, e.created_at 
                 FROM events e
                 LEFT JOIN clients c ON c.id = e.client_id
                 WHERE 1=1`;
    const params = [];

    // Фильтр по датам
    if (dateFrom) {
      const ts = Math.floor(new Date(dateFrom).getTime() / 1000);
      query += ` AND e.created_at >= ?`;
      params.push(ts);
    }
    if (dateTo) {
      const ts = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);
      query += ` AND e.created_at <= ?`;
      params.push(ts);
    }

    query += ` ORDER BY e.created_at DESC LIMIT ?`;
    params.push(limit);

    const { results } = await env.radar_group_db.prepare(query).bind(...params).all();

    return Response.json({ ok: true, logs: results });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}