// ============================================
// /api/events — приём событий от виджета
// POST /api/events
// { api_key, event_name, dialog_id?, lang? }
// ============================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { api_key, event_name, dialog_id, lang } = body;
    const langSafe = lang === 'en' ? 'en' : 'ru';

    if (!api_key || !event_name) {
      return jsonResponse({ ok: false, error: 'api_key и event_name обязательны' }, 400);
    }

    // Найти клиента по api_key
    const client = await env.radar_group_db.prepare(
      'SELECT id FROM clients WHERE api_key = ?'
    ).bind(api_key).first();

    if (!client) {
      return jsonResponse({ ok: false, error: 'Invalid api_key' }, 401);
    }

    const id = 'evt_' + crypto.randomUUID().slice(0, 8);
    await env.radar_group_db.prepare(
      `INSERT INTO events (id, client_id, event_name, dialog_id, language)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, client.id, event_name, dialog_id || null, langSafe).run();

    return jsonResponse({ ok: true, event_id: id });
  } catch (err) {
    console.error('Events error:', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}