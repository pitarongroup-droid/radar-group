// ============================================
// /api/admin/logs — логи (ошибки, отладка, события)
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    let query = 'SELECT * FROM logs';
    const params = [];

    if (clientId) {
      query += ' WHERE client_id = ?';
      params.push(clientId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.radar_group_db.prepare(query).bind(...params).all();
    return Response.json({ ok: true, logs: results });
  } catch (err) {
    console.error('Logs GET error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}