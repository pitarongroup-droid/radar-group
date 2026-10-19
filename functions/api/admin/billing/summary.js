// ============================================
// /api/billing/summary — данные об оплате для клиента
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    const payload = decodeJWT(token);
    
    if (!payload || !payload.clientId) {
      return Response.json({ ok: false, error: { ru: 'Не авторизован', en: 'Unauthorized' } }, { status: 401 });
    }

    // Получаем данные клиента
    const client = await env.radar_group_db.prepare(
      `SELECT tariff_code, monthly_price, sub_currency, subscription_end, next_payment_due, account_status 
       FROM clients WHERE id = ?`
    ).bind(payload.clientId).first();

    if (!client) {
      return Response.json({ ok: false, error: { ru: 'Клиент не найден', en: 'Client not found' } }, { status: 404 });
    }

    // Получаем историю платежей
    const { results: payments } = await env.radar_group_db.prepare(
      `SELECT amount, currency, paid_at, period_start, period_end, method 
       FROM payments WHERE client_id = ? ORDER BY paid_at DESC`
    ).bind(payload.clientId).all();

    return Response.json({
      ok: true,
      subscription: {
        tariff_code: client.tariff_code,
        monthly_price: client.monthly_price,
        currency: client.sub_currency,
        subscription_end: client.subscription_end,
        next_payment_due: client.next_payment_due,
        subscription_status: client.account_status // или логика based on date
      },
      payments: payments || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message, en: err.message } }, { status: 500 });
  }
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch (e) { return null; }
}