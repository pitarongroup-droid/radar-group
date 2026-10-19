export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    
    // Простой парсинг JWT
    const parts = token.split('.');
    if (parts.length !== 3) return Response.json({ ok: false }, { status: 401 });
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    if (!payload || !payload.clientId) return Response.json({ ok: false }, { status: 401 });

    const client = await env.radar_group_db.prepare(
      `SELECT tariff_code, monthly_price, sub_currency, subscription_end, next_payment_due, account_status 
       FROM clients WHERE id = ?`
    ).bind(payload.clientId).first();

    if (!client) return Response.json({ ok: false }, { status: 404 });

    const { results: payments } = await env.radar_group_db.prepare(
      `SELECT amount, currency, paid_at, period_start, period_end FROM payments WHERE client_id = ? ORDER BY paid_at DESC`
    ).bind(payload.clientId).all();

    return Response.json({
      ok: true,
      subscription: {
        tariff_code: client.tariff_code,
        monthly_price: client.monthly_price,
        currency: client.sub_currency || 'BYN',
        subscription_end: client.subscription_end,
        next_payment_due: client.next_payment_due,
        subscription_status: client.account_status
      },
      payments: payments || []
    });
  } catch (err) {
    return Response.json({ ok: false }, { status: 500 });
  }
}