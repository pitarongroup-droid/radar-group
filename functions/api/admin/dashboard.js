export async function onRequestGet({ env }) {
  try {
    // Используем ISO строку для корректного сравнения в SQLite
    const monthAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();

    const clientsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM clients WHERE account_status != 'suspended'`
    ).first();

    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs`
    ).first();

    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE is_lead = 1`
    ).first();

    // Убрали несуществующую колонку status = 'paid'
    const revenue = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE paid_at > ?`
    ).bind(monthAgoIso).first();

    const apiCost = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(m.cost_usd), 0) as s 
       FROM messages m
       JOIN dialogs d ON d.id = m.dialog_id
       WHERE datetime(m.created_at) > datetime('now', '-30 days')`
    ).first();

    // Возвращаем И tariff_code, И алиас plan, И account_status, И алиас status
    const { results: recentClients } = await env.radar_group_db.prepare(
      `SELECT c.id, c.name, c.email, c.created_at,
              c.tariff_code, c.tariff_code as plan, 
              c.account_status, c.account_status as status,
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