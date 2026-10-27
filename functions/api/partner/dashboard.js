export async function onRequestGet({ request, env }) {
  try {
    // 1. Берем токен из заголовка
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return Response.json({ ok: false, error: 'Нет токена' }, { status: 401 });

    // 2. Расшифровываем токен (проверяем, что это партнер)
    let payload;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(atob(base64));
    } catch (e) {
      return Response.json({ ok: false, error: 'Неверный токен' }, { status: 401 });
    }

    if (payload.role !== 'partner' || !payload.partnerId) {
      return Response.json({ ok: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const partnerId = payload.partnerId;

    // 3. Дальше весь код остается тем же (получаем данные партнера и статистику)
    const partner = await env.radar_group_db.prepare(
      'SELECT name, ref_code FROM partners WHERE id = ?'
    ).bind(partnerId).first();

    if (!partner) return Response.json({ ok: false, error: 'Партнер не найден' });

    const totalClients = await env.radar_group_db.prepare(
      'SELECT COUNT(*) as c FROM clients WHERE referred_by = ?'
    ).bind(partnerId).first();

    const paidClients = await env.radar_group_db.prepare(
      `SELECT COUNT(DISTINCT p.client_id) as c 
       FROM payments p 
       JOIN clients c ON c.id = p.client_id 
       WHERE c.referred_by = ?`
    ).bind(partnerId).first();

    const balance = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) as s 
       FROM commissions WHERE partner_id = ? AND status = 'pending'`
    ).bind(partnerId).first();

    const totalEarned = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) as s 
       FROM commissions WHERE partner_id = ?`
    ).bind(partnerId).first();

    const paidCount = paidClients.c || 0;
    const currentRate = paidCount > 10 ? 10 : 6;

    const { results: recentClients } = await env.radar_group_db.prepare(
      `SELECT c.id, c.name, c.email, c.account_status, c.created_at,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE client_id = c.id) as total_paid
       FROM clients c 
       WHERE c.referred_by = ? 
       ORDER BY c.created_at DESC LIMIT 10`
    ).bind(partnerId).all();

    return Response.json({
      ok: true,
      partner: { name: partner.name, ref_code: partner.ref_code },
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
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}