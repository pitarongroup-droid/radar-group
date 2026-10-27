export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    
    // Жесткая проверка, чтобы D1 не падал с ошибкой undefined
    const client_id = b.client_id;
    const amount = Number(b.amount) || 0; // Приводим к числу для безопасности
    const currency = b.currency || 'BYN';
    const tariff_code = b.tariff_code || 'start';
    const monthly_price = Number(b.monthly_price) || 0;

    if (!client_id) return Response.json({ ok: false, error: { ru: 'Нет ID клиента' } });

    // ДОБАВЛЕНО: Запрашиваем referred_by, чтобы знать, есть ли партнер
    const client = await env.radar_group_db.prepare(
      `SELECT subscription_end, referred_by FROM clients WHERE id = ?`
    ).bind(client_id).first();
    
    if (!client) return Response.json({ ok: false, error: { ru: 'Клиент не найден' } });

    let startDate = client.subscription_end ? new Date(client.subscription_end) : new Date();
    if (startDate < new Date()) startDate = new Date();

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // ДОБАВЛЕНО: Выносим генерацию ID платежа в переменную, чтобы использовать её для комиссии
    const paymentId = 'pay_' + crypto.randomUUID().slice(0, 8);

    // Записываем в историю платежей
    await env.radar_group_db.prepare(
      `INSERT INTO payments (id, client_id, amount, currency, period_start, period_end, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      paymentId, 
      client_id, amount, currency, startStr, endStr, new Date().toISOString()
    ).run();

    // Обновляем карточку клиента
    await env.radar_group_db.prepare(
      `UPDATE clients SET 
        subscription_end = ?, 
        next_payment_due = ?, 
        tariff_code = ?, 
        monthly_price = ?, 
        sub_currency = ? 
       WHERE id = ?`
    ).bind(endStr, endStr, tariff_code, monthly_price, currency, client_id).run();

    // ============================================
    // 🤝 БЛОК НАЧИСЛЕНИЯ ПАРТНЕРСКИХ КОМИССИЙ
    // ============================================
    try {
      if (client.referred_by) {
        const partnerId = client.referred_by;

        // 1. Считаем, сколько УНИКАЛЬНЫХ клиентов этого партнера уже оплатили
        const paidClientsCount = await env.radar_group_db.prepare(
          `SELECT COUNT(DISTINCT p.client_id) as c
           FROM payments p
           JOIN clients c ON c.id = p.client_id
           WHERE c.referred_by = ?`
        ).bind(partnerId).first();

        const totalPaidClients = paidClientsCount.c || 0;

        // 2. Определяем ставку: до 10 клиентов (включительно) = 6%, свыше 10 = 10%
        const rate = totalPaidClients > 10 ? 0.10 : 0.06;
        
        // 3. Считаем сумму комиссии
        const commissionAmount = amount * rate;

        // 4. Записываем начисление в базу
        if (commissionAmount > 0) {
          await env.radar_group_db.prepare(
            `INSERT INTO commissions 
             (id, partner_id, client_id, payment_id, amount, rate, commission_amount, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
          ).bind(
            'com_' + crypto.randomUUID().slice(0, 8),
            partnerId,
            client_id,
            paymentId,
            amount,
            rate,
            commissionAmount
          ).run();
        }
      }
    } catch (affErr) {
      // Если начисление упадет с ошибкой, мы просто запишем её в логи, 
      // но оплата клиента всё равно вернет успех.
      console.error('Affiliate commission error:', affErr);
    }

    return Response.json({ ok: true, new_subscription_end: endStr, new_next_payment_due: endStr });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}