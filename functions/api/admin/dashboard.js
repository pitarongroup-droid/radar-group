export async function onRequestGet({ env }) {
  try {
    const clientsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM clients WHERE account_status != 'suspended'`
    ).first();

    const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE created_at > ?`
    ).bind(monthAgo).first();

    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE is_lead = 1 AND created_at > ?`
    ).bind(monthAgo).first();

    // ИСПРАВЛЕНО: убрали status = 'paid'
    const revenue = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE paid_at > ?`
    ).bind(monthAgo).first();

    const apiCost = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(m.cost_usd), 0) as s 
       FROM messages m
       JOIN dialogs d ON d.id = m.dialog_id
       WHERE m.created_at > ?`
    ).bind(monthAgo).first();

    // ИСПРАВЛЕНО: берем tariff_code и account_status
    const { results: recentClients } = await env.radar_group_db.prepare(
      `SELECT c.id, c.name, c.email, c.tariff_code as plan, c.account_status as status, c.created_at,
              (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id) as dialogs_count,
              (SELECT COUNT(*) FROM dialogs WHERE client_id = c.id AND is_lead = 1) as leads_count
       FROM clients c
       ORDER BY c.created_at DESC
       LIMIT 5`
    ).all();

    return Response.json({
      ok: true,
      stats: {
        clients: clientsCount.c || 0,
        dialogs: dialogsCount.c || 0,
        leads: leadsCount.c || 0,
        revenue: revenue.s || 0,
        api_cost: apiCost.s || 0
      },
      recent_clients: recentClients || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message, en: err.message } }, { status: 500 });
  }
}