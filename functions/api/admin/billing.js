export async function onRequestGet({ env }) {
  try {
    const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

    const revenue = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as s FROM payments 
       WHERE status = 'paid' AND paid_at > ?`
    ).bind(monthAgo).first();

    const paymentsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM payments 
       WHERE status = 'paid' AND paid_at > ?`
    ).bind(monthAgo).first();

    const activeSubs = await env.radar_group_db.prepare(
      `SELECT COUNT(DISTINCT client_id) as c FROM payments 
       WHERE status = 'paid' AND paid_at > ?`
    ).bind(monthAgo).first();

    const { results: payments } = await env.radar_group_db.prepare(
      `SELECT p.*, c.name as client_name
       FROM payments p
       LEFT JOIN clients c ON c.id = p.client_id
       ORDER BY p.created_at DESC
       LIMIT 50`
    ).all();

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
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}