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

    // 1. Считаем ВСЕ диалоги клиента (без фильтра по дате)
    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ?`
    ).bind(clientId).first();

    // 2. Считаем ВСЕ лиды клиента (без фильтра по дате)
    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ? AND is_lead = 1`
    ).bind(clientId).first();

    const totalDialogs = dialogsCount.c || 0;
    const totalLeads = leadsCount.c || 0;
    const conversion = totalDialogs > 0 ? Math.round((totalLeads / totalDialogs) * 100) : 0;

    // 3. Достаем последние 5 лидов
    const { results: recentLeads } = await env.radar_group_db.prepare(
      `SELECT id, user_name, user_contact, lead_data, created_at
       FROM dialogs
       WHERE client_id = ? AND is_lead = 1
       ORDER BY created_at DESC
       LIMIT 5`
    ).bind(clientId).all();

    return Response.json({
      ok: true,
      stats: {
        dialogs: totalDialogs,
        leads: totalLeads,
        cost: 0, // Отключили подсчет API, чтобы не было ошибок
        conversion: conversion
      },
      recent_leads: recentLeads || []
    });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}