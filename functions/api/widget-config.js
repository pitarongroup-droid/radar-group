// ============================================
// /api/widget-config — настройки виджета для клиента
// GET /api/widget-config?key=rg_live_xxx&lang=ru
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('key');
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ru';

    if (!apiKey) {
      return Response.json(
        { ok: false, error: { ru: 'API-ключ обязателен', en: 'API key required' } },
        { status: 400 }
      );
    }

    // Найти клиента по api_key
    const client = await env.radar_group_db.prepare(
      'SELECT id, name, status, account_status FROM clients WHERE api_key = ?'
    ).bind(apiKey).first();

    if (!client) {
      return Response.json(
        { ok: false, error: { ru: 'Клиент не найден', en: 'Client not found' } },
        { status: 404 }
      );
    }

    // ⚠️ ИСПРАВЛЕНО: Проверка и старого статуса и нового account_status
    if (client.status === 'suspended' || client.account_status !== 'approved') {
      return Response.json(
        { ok: false, error: { ru: 'Виджет отключён', en: 'Widget disabled' } },
        { status: 403 }
      );
    }

    // Настройки виджета
    const s = await env.radar_group_db.prepare(
      `SELECT widget_color, widget_title_ru, widget_title_en,
              widget_welcome_ru, widget_welcome_en, widget_position, widget_enabled
       FROM settings WHERE client_id = ?`
    ).bind(client.id).first();

    // ⚠️ ИСПРАВЛЕНО: Проверка, что услуга виджета включена
    if (!s || s.widget_enabled !== 1) {
      return Response.json(
        { ok: false, error: { ru: 'Услуга виджета не подключена', en: 'Widget service not enabled' } },
        { status: 403 }
      );
    }

    const isEn = lang === 'en';

    return Response.json({
      ok: true,
      client_id: client.id,
      client_name: client.name,
      lang: lang,
      color: s?.widget_color || '#00F0FF',
      title: isEn
        ? (s?.widget_title_en || 'AI Manager')
        : (s?.widget_title_ru || 'ИИ-менеджер'),
      welcome: isEn
        ? (s?.widget_welcome_en || 'Hello! How can I help?')
        : (s?.widget_welcome_ru || 'Здравствуйте! Чем помочь?'),
      position: s?.widget_position || 'right'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store' // ⚠️ ИСПРАВЛЕНО: Отключаем кэш
      }
    });

  } catch (err) {
    console.error('Widget config error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}