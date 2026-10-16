// ============================================
// GET /api/bot — health check для VPS
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { c } = await env.radar_group_db.prepare(
      `SELECT COUNT(*) AS c FROM settings WHERE bot_enabled = 1`
    ).first();

    const { c: approved } = await env.radar_group_db.prepare(
      `SELECT COUNT(*) AS c FROM clients WHERE account_status = 'approved'`
    ).first();

    return Response.json({
      ok: true,
      service: 'radar-bot-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      stats: {
        bots_enabled: c || 0,
        clients_approved: approved || 0
      }
    });

  } catch (err) {
    console.error('Bot health error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}