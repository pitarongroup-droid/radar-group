export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    
    // Жесткая проверка, чтобы D1 не падал с ошибкой undefined
    const client_id = b.client_id;
    const amount = b.amount || 0;
    const currency = b.currency || 'BYN';
    const tariff_code = b.tariff_code || 'start';
    const monthly_price = b.monthly_price || 0;

    if (!client_id) return Response.json({ ok: false, error: { ru: 'Нет ID клиента' } });

    const client = await env.radar_group_db.prepare(
      `SELECT subscription_end FROM clients WHERE id = ?`
    ).bind(client_id).first();
    
    if (!client) return Response.json({ ok: false, error: { ru: 'Клиент не найден' } });

    let startDate = client.subscription_end ? new Date(client.subscription_end) : new Date();
    if (startDate < new Date()) startDate = new Date();

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Записываем в историю платежей
    await env.radar_group_db.prepare(
      `INSERT INTO payments (id, client_id, amount, currency, period_start, period_end, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      'pay_' + crypto.randomUUID().slice(0, 8), 
      client_id, amount, currency, startStr, endStr, new Date().toISOString()
    ).run();

    // Обновляем карточку клиента (сохраняем тариф и даты)
    await env.radar_group_db.prepare(
      `UPDATE clients SET 
        subscription_end = ?, 
        next_payment_due = ?, 
        tariff_code = ?, 
        monthly_price = ?, 
        sub_currency = ? 
       WHERE id = ?`
    ).bind(endStr, endStr, tariff_code, monthly_price, currency, client_id).run();

    return Response.json({ ok: true, new_subscription_end: endStr, new_next_payment_due: endStr });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}