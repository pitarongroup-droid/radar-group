// ============================================
// POST /api/admin/partners/payout — отметить комиссии как выплаченные
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const { partner_id } = await request.json();

    if (!partner_id) {
      return Response.json({ ok: false, error: 'Не указан ID партнера' }, { status: 400 });
    }

    // Обновляем все "pending" комиссии этого партнера на "paid"
    // и записываем время выплаты
    const result = await env.radar_group_db.prepare(
      `UPDATE commissions 
       SET status = 'paid', paid_at = unixepoch() 
       WHERE partner_id = ? AND status = 'pending'`
    ).bind(partner_id).run();

    return Response.json({ 
      ok: true, 
      message: `Выплачено записей: ${result.meta.changes}` 
    });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}