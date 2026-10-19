export async function onRequestPost({ request, env }) {
  try {
    const { client_id, amount, currency } = await request.json();
    
    // Получаем текущую дату окончания подписки
    const client = await env.radar_group_db.prepare(
      `SELECT subscription_end FROM clients WHERE id = ?`
    ).bind(client_id).first();
    
    if (!client) return Response.json({ ok: false, error: { ru: 'Клиент не найден' } });

    // Вычисляем новые даты
    let startDate = client.subscription_end ? new Date(client.subscription_end) : new Date();
    if (startDate < new Date()) startDate = new Date(); // если просрочено, начинаем с сегодня

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // + 1 месяц

    // Форматируем в YYYY-MM-DD для базы данных
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Записываем платёж в историю
    await env.radar_group_db.prepare(
      `INSERT INTO payments (id, client_id, amount, currency, period_start, period_end, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      'pay_' + crypto.randomUUID().slice(0, 8), 
      client_id, 
      amount, 
      currency, 
      startStr, 
      endStr, 
      new Date().toISOString()
    ).run();

    // Продлеваем подписку клиенту
    await env.radar_group_db.prepare(
      `UPDATE clients SET subscription_end = ?, next_payment_due = ? WHERE id = ?`
    ).bind(endStr, endStr, client_id).run();

    return Response.json({ 
      ok: true, 
      new_subscription_end: endStr, 
      new_next_payment_due: endStr 
    });
  } catch (err) {
    console.error('Payment error:', err);
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}