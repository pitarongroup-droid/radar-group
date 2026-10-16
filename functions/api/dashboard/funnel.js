// ============================================
// /api/dashboard/funnel — воронка + метрики
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return unauthorized();

    const payload = decodeJWT(token);
    if (!payload?.clientId) return unauthorized();

    const clientId = payload.clientId;
    const dayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    // Воронка
    const chatOpened = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM events 
       WHERE client_id = ? AND event_name = 'chat_open'`
    ).bind(clientId).first();

    const dialogs = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs WHERE client_id = ?`
    ).bind(clientId).first();

    const leads = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs 
       WHERE client_id = ? AND is_lead = 1`
    ).bind(clientId).first();

    // Лидов сегодня
    const leadsToday = await env.radar_group_db.prepare(
      `SELECT COUNT(*) as c FROM dialogs 
       WHERE client_id = ? AND is_lead = 1 AND created_at > ?`
    ).bind(clientId, dayStart).first();

    const dialogsNum = dialogs.c || 0;
    const leadsNum = leads.c || 0;

    const conversion = dialogsNum > 0 
      ? Math.round((leadsNum / dialogsNum) * 100) 
      : 0;

    return Response.json({
      ok: true,
      funnel: {
        chat_opened: chatOpened.c || 0,
        dialogs: dialogsNum,
        leads: leadsNum
      },
      metrics: {
        leads_today: leadsToday.c || 0,
        conversion: conversion
      }
    });
  } catch (err) {
    console.error('Funnel error:', err);
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
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch (e) {
    return null;
  }
}

function unauthorized() {
  return Response.json(
    { ok: false, error: { ru: 'Не авторизован', en: 'Unauthorized' } },
    { status: 401 }
  );
}