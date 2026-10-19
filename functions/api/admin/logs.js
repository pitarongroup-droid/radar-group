export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    // ИСПРАВЛЕНО: читаем из таблицы events
    const { results } = await env.radar_group_db.prepare(
      `SELECT e.id, e.event_name as level, e.event_name as message, 
              c.name as source, e.created_at 
       FROM events e
       LEFT JOIN clients c ON c.id = e.client_id
       ORDER BY e.created_at DESC LIMIT ?`
    ).bind(limit).all();

    return Response.json({ ok: true, logs: results });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}