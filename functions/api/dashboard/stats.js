// ============================================
// /api/dashboard/stats — метрики клиента
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');

    if (!token) {
      return Response.json(
        { ok: false, error: { ru: 'Не авторизован', en: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const payload = decodeJWT(token);
    if (!payload || !payload.clientId) {
      return Response.json(
        { ok: false, error: { ru: 'Неверный токен', en: 'Invalid token' } },
        { status: 401 }
      );
    }

    const clientId = payload.clientId;
    const monthAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

    const dialogsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ? AND created_at > ?`
    ).bind(clientId, monthAgo).first();

    const leadsCount = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ? AND is_lead = 1 AND created_at > ?`
    ).bind(clientId, monthAgo).first();

    const apiCost = await env.radar_group_db.prepare(
      `SELECT COALESCE(SUM(m.cost_usd), 0) as s 
       FROM messages m
       JOIN dialogs d ON d.id = m.dialog_id
       WHERE d.client_id = ? AND m.created_at > ?`
    ).bind(clientId, monthAgo).first();

    const totalDialogs = dialogsCount.c || 0;
    const totalLeads = leadsCount.c || 0;
    const conversion = totalDialogs > 0 ? Math.round((totalLeads / totalDialogs) * 100) : 0;

    const { results: recentLeads } = await env.radar_group_db.prepare(
      `SELECT d.id, d.user_name, d.user_contact, d.lead_data, d.created_at
       FROM dialogs d
       WHERE d.client_id = ? AND d.is_lead = 1
       ORDER BY d.created_at DESC
       LIMIT 5`
    ).bind(clientId).all();

    return Response.json({
      ok: true,
      stats: {
        dialogs: totalDialogs,
        leads: totalLeads,
        cost: apiCost.s || 0,
        conversion: conversion
      },
      recent_leads: recentLeads || []
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}