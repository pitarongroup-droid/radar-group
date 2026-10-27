export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    // Определяем временные рамки (в секундах)
    let fromTs, toTs;
    if (dateFrom && dateTo) {
      fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
      toTs = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);
    } else {
      // По умолчанию - последние 30 дней
      toTs = Math.floor(Date.now() / 1000) + 86400; 
      fromTs = toTs - (30 * 86400);
    }

    // 1. Всего клиентов (без фильтра по датам, так как это общий показатель)
    const clientsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM clients WHERE account_status != 'suspended'`
    ).first();

    // 2. Диалогов (за выбранный период)
    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE created_at >= ? AND created_at <= ?`
    ).bind(fromTs, toTs).first();

    // 3. Лидов (за выбранный период)
    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE is_lead = 1 AND created_at >= ? AND created_at <= ?`
    ).bind(fromTs, toTs).first();

    // 4. Выручка (за выбранный период)
    const revenue = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE paid_at >= ? AND paid_at <= ?`
    ).bind(fromTs, toTs).first();

    // 5. Расход API (за выбранный период)
    // Если у тебя была ошибка с cost_usd, этот блок может её вызвать. 
    // Если она повторится, мы просто закомментируем этот запрос.
    const apiCost = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(m.cost_usd), 0) as s 
       FROM messages m
       JOIN dialogs d ON d.id = m.dialog_id
       WHERE m.created_at >= ? AND m.created_at <= ?`
    ).bind(fromTs, toTs).first();

    // 6. Последние 5 клиентов (список всегда показывает самых новых)
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