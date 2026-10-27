// ============================================
// /api/dashboard/stats — метрики клиента
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');

    if (!token) {
      return Response.json({ ok: false, error: { ru: 'Не авторизован' } }, { status: 401 });
    }

    const parts = token.split('.');
    if (parts.length !== 3) return Response.json({ ok: false }, { status: 401 });
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    if (!payload || !payload.clientId) {
      return Response.json({ ok: false, error: { ru: 'Неверный токен' } }, { status: 401 });
    }

    const clientId = payload.clientId;
    
    // Получаем параметры дат (если они переданы)
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');

    let dateCondition = '';
    let dateParams = [];
    
    // Если переданы обе даты - фильтруем по ним
    if (dateFrom && dateTo) {
      const fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
      const toTs = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);
      dateCondition = ` AND created_at >= ? AND created_at <= ?`;
      dateParams = [fromTs, toTs];
    }

    // 1. Считаем диалоги (с учетом дат, если выбраны)
    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ?${dateCondition}`
    ).bind(clientId, ...dateParams).first();

    // 2. Считаем лиды (с учетом дат)
    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ? AND is_lead = 1${dateCondition}`
    ).bind(clientId, ...dateParams).first();

    const totalDialogs = dialogsCount.c || 0;
    const totalLeads = leadsCount.c || 0;
    const conversion = totalDialogs > 0 ? Math.round((totalLeads / totalDialogs) * 100) : 0;

    // 3. Достаем последние 5 лидов (с учетом дат)
    const { results: recentLeads } = await env.radar_group_db.prepare(
      `SELECT id, user_name, user_contact, lead_data, created_at
       FROM dialogs
       WHERE client_id = ? AND is_lead = 1${dateCondition}
       ORDER BY created_at DESC
       LIMIT 5`
    ).bind(clientId, ...dateParams).all();

    return Response.json({
      ok: true,
      stats: {
        dialogs: totalDialogs,
        leads: totalLeads,
        cost: 0, // Оставляем 0, как у тебя и было, чтобы не было ошибок
        conversion: conversion
      },
      recent_leads: recentLeads || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}