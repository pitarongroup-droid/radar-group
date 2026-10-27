export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    // Пока берем ID партнера из URL (для теста). Позже заменим на проверку токена.
    const partnerId = url.searchParams.get('partner_id') || 'prt_test'; 

    // 1. Получаем данные партнера
    const partner = await env.radar_group_db.prepare(
      'SELECT name, ref_code FROM partners WHERE id = ?'
    ).bind(partnerId).first();

    if (!partner) return Response.json({ ok: false, error: 'Партнер не найден' });

    // 2. Считаем общее количество приведенных клиентов
    const totalClients = await env.radar_group_db.prepare(
      'SELECT COUNT(*) as c FROM clients WHERE referred_by = ?'
    ).bind(partnerId).first();

    // 3. Считаем количество клиентов, которые уже оплатили (для лестницы)
    const paidClients = await env.radar_group_db.prepare(
      `SELECT COUNT(DISTINCT p.client_id) as c 
       FROM payments p 
       JOIN clients c ON c.id = p.client_id 
       WHERE c.referred_by = ?`
    ).bind(partnerId).first();

    // 4. Считаем баланс (только статус pending — то, что еще не выплачено)
    const balance = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) as s 
       FROM commissions WHERE partner_id = ? AND status = 'pending'`
    ).bind(partnerId).first();

    // 5. Считаем общий заработок за всё время
    const totalEarned = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) as s 
       FROM commissions WHERE partner_id = ?`
    ).bind(partnerId).first();

    const paidCount = paidClients.c || 0;
    // Определяем текущий процент
    const currentRate = paidCount > 10 ? 10 : 6;

    // 6. Получаем последних 10 приведенных клиентов
    const { results: recentClients } = await env.radar_group_db.prepare(
      `SELECT c.id, c.name, c.email, c.account_status, c.created_at,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE client_id = c.id) as total_paid
       FROM clients c 
       WHERE c.referred_by = ? 
       ORDER BY c.created_at DESC LIMIT 10`
    ).bind(partnerId).all();

    return Response.json({
      ok: true,
      partner: { 
        name: partner.name, 
        ref_code: partner.ref_code 
      },
      stats: {
        total_clients: totalClients.c || 0,
        paid_clients: paidCount,
        balance: balance.s || 0,
        total_earned: totalEarned.s || 0,
        current_rate: currentRate
      },
      recent_clients: recentClients || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}