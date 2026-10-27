export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    // Формируем временные рамки для строкового поля paid_at
    let startIso = null;
    let endIso = null;

    if (dateFrom && dateTo) {
      startIso = `${dateFrom}T00:00:00.000Z`;
      endIso = `${dateTo}T23:59:59.999Z`;
    } else if (dateFrom) {
      startIso = `${dateFrom}T00:00:00.000Z`;
    } else if (dateTo) {
      endIso = `${dateTo}T23:59:59.999Z`;
    }

    // 1. Считаем статистику (Выручка и Кол-во)
    let statsCondition = '';
    let statsParams = [];

    if (startIso) {
      statsCondition += ` AND paid_at >= ?`;
      statsParams.push(startIso);
    }
    if (endIso) {
      statsCondition += ` AND paid_at <= ?`;
      statsParams.push(endIso);
    }
    
    // Если пользователь выбрал "Всё время" (дат нет), для карточек оставляем фильтр 30 дней
    if (!startIso && !endIso) {
      const monthAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();
      statsCondition += ` AND paid_at >= ?`;
      statsParams.push(monthAgoIso);
    }

    const revenue = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * 3.2 ELSE amount END), 0) as s 
       FROM payments WHERE 1=1 ${statsCondition}`
    ).bind(...statsParams).first();
    
    const paymentsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM payments WHERE 1=1 ${statsCondition}`
    ).bind(...statsParams).first();
    
    // Активные подписки (это текущее состояние, не зависит от дат)
    const activeSubs = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM clients WHERE next_payment_due >= date('now')`
    ).first();
    
    // 2. Достаем историю платежей с учетом выбранных дат
    let historyCondition = '';
    let historyParams = [];

    if (startIso) {
      historyCondition += ` AND p.paid_at >= ?`;
      historyParams.push(startIso);
    }
    if (endIso) {
      historyCondition += ` AND p.paid_at <= ?`;
      historyParams.push(endIso);
    }

    const { results: payments } = await env.radar_group_db.prepare(
      `SELECT p.*, c.name as client_name 
       FROM payments p 
       LEFT JOIN clients c ON c.id = p.client_id 
       WHERE 1=1 ${historyCondition}
       ORDER BY p.paid_at DESC LIMIT 50`
    ).bind(...historyParams).all();

    const revenueNum = revenue.s || 0;
    const paymentsNum = paymentsCount.c || 0;
    const avgCheck = paymentsNum > 0 ? revenueNum / paymentsNum : 0;

    return Response.json({
      ok: true,
      stats: { 
        revenue: revenueNum, 
        active_subs: activeSubs.c || 0, 
        avg_check: Math.round(avgCheck) 
      },
      payments: payments || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}