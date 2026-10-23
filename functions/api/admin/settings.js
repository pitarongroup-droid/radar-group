// ============================================
// /api/admin/settings — полные настройки клиента (АДМИН)
// GET  — получить настройки
// PUT  — сохранить (виджет + бот + AI + каналы + флаги ключа)
// ⚠️ Проверяет role = admin
// ============================================

export async function onRequestGet({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');

    if (!clientId) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    const settings = await env.radar_group_db.prepare(
      'SELECT * FROM settings WHERE client_id = ?'
    ).bind(clientId).first();

    return Response.json({ ok: true, settings: settings || {} });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const b = await request.json();

    if (!b.client_id) {
      return Response.json(
        { ok: false, error: { ru: 'client_id обязателен', en: 'client_id required' } },
        { status: 400 }
      );
    }

    // Убедиться, что запись существует
    const existing = await env.radar_group_db.prepare(
      'SELECT client_id FROM settings WHERE client_id = ?'
    ).bind(b.client_id).first();

    if (!existing) {
      await env.radar_group_db.prepare(
        'INSERT INTO settings (client_id) VALUES (?)'
      ).bind(b.client_id).run();
    }

    // ⚠️ НОВОЕ: Получаем состояние ДО обновления, чтобы отследить изменения
    const before = await env.radar_group_db.prepare(
      'SELECT business_bot_enabled, bot_enabled FROM settings WHERE client_id = ?'
    ).bind(b.client_id).first();

    // ВИДЖЕТ
    await env.radar_group_db.prepare(
      `UPDATE settings SET
         prompt_ru = COALESCE(?, prompt_ru),
         prompt_en = COALESCE(?, prompt_en),
         ai_provider = COALESCE(?, ai_provider),
         ai_api_key = COALESCE(?, ai_api_key),
         ai_base_url = COALESCE(?, ai_base_url),
         industry = COALESCE(?, industry),
         services = COALESCE(?, services),
         widget_title_ru = COALESCE(?, widget_title_ru),
         widget_title_en = COALESCE(?, widget_title_en),
         widget_welcome_ru = COALESCE(?, widget_welcome_ru),
         widget_welcome_en = COALESCE(?, widget_welcome_en),
         widget_color = COALESCE(?, widget_color),
         widget_position = COALESCE(?, widget_position),
         telegram_token = COALESCE(?, telegram_token),
         telegram_admin_id = COALESCE(?, telegram_admin_id),
         sheets_url = COALESCE(?, sheets_url),
         webhook_url = COALESCE(?, webhook_url),
         webhook_secret = COALESCE(?, webhook_secret),
         notification_email = COALESCE(?, notification_email),
         max_daily_requests = COALESCE(?, max_daily_requests),
         channel_telegram_enabled = COALESCE(?, channel_telegram_enabled),
         channel_sheets_enabled = COALESCE(?, channel_sheets_enabled),
         channel_webhook_enabled = COALESCE(?, channel_webhook_enabled),
         channel_email_enabled = COALESCE(?, channel_email_enabled),
         admin_allow_telegram = COALESCE(?, admin_allow_telegram),
         admin_allow_sheets = COALESCE(?, admin_allow_sheets),
         admin_allow_webhook = COALESCE(?, admin_allow_webhook),
         admin_allow_email = COALESCE(?, admin_allow_email),
         use_radar_ai_key_widget = COALESCE(?, use_radar_ai_key_widget),
         use_radar_ai_key_bot = COALESCE(?, use_radar_ai_key_bot),
         
         business_bot_enabled = COALESCE(?, business_bot_enabled),
         business_connection_id = COALESCE(?, business_connection_id),
         
         updated_at = unixepoch()
       WHERE client_id = ?`
    ).bind(
      b.prompt_ru ?? null,
      b.prompt_en ?? null,
      b.ai_provider ?? null,
      b.ai_api_key ?? null,
      b.ai_base_url ?? null,
      b.industry ?? null,
      b.services ?? null,
      b.widget_title_ru ?? null,
      b.widget_title_en ?? null,
      b.widget_welcome_ru ?? null,
      b.widget_welcome_en ?? null,
      b.widget_color ?? null,
      b.widget_position ?? null,
      b.telegram_token ?? null,
      b.telegram_admin_id ?? null,
      b.sheets_url ?? null,
      b.webhook_url ?? null,
      b.webhook_secret ?? null,
      b.notification_email ?? null,
      b.max_daily_requests ?? null,
      b.channel_telegram_enabled !== undefined ? (b.channel_telegram_enabled ? 1 : 0) : null,
      b.channel_sheets_enabled !== undefined ? (b.channel_sheets_enabled ? 1 : 0) : null,
      b.channel_webhook_enabled !== undefined ? (b.channel_webhook_enabled ? 1 : 0) : null,
      b.channel_email_enabled !== undefined ? (b.channel_email_enabled ? 1 : 0) : null,
      b.admin_allow_telegram !== undefined ? (b.admin_allow_telegram ? 1 : 0) : null,
      b.admin_allow_sheets !== undefined ? (b.admin_allow_sheets ? 1 : 0) : null,
      b.admin_allow_webhook !== undefined ? (b.admin_allow_webhook ? 1 : 0) : null,
      b.admin_allow_email !== undefined ? (b.admin_allow_email ? 1 : 0) : null,
      b.use_radar_ai_key_widget !== undefined ? (b.use_radar_ai_key_widget ? 1 : 0) : null,
      b.use_radar_ai_key_bot !== undefined ? (b.use_radar_ai_key_bot ? 1 : 0) : null,
      
      b.business_bot_enabled !== undefined ? (b.business_bot_enabled ? 1 : 0) : null,
      b.business_connection_id || null,
      
      b.client_id
    ).run();

    // БОТ
    await env.radar_group_db.prepare(
      `UPDATE settings SET
         bot_greeting_ru = COALESCE(?, bot_greeting_ru),
         bot_prompt_ru = COALESCE(?, bot_prompt_ru),
         bot_prompt_en = COALESCE(?, bot_prompt_en),
         bot_ai_provider = COALESCE(?, bot_ai_provider),
         bot_ai_api_key = COALESCE(?, bot_ai_api_key),
         bot_ai_base_url = COALESCE(?, bot_ai_base_url),
         bot_telegram_token = COALESCE(?, bot_telegram_token),
         bot_telegram_admin_id = COALESCE(?, bot_telegram_admin_id),
         bot_industry = COALESCE(?, bot_industry),
         bot_services = COALESCE(?, bot_services),
         bot_sheets_url = COALESCE(?, bot_sheets_url),
         bot_webhook_url = COALESCE(?, bot_webhook_url),
         bot_webhook_secret = COALESCE(?, bot_webhook_secret),
         bot_notification_email = COALESCE(?, bot_notification_email),
         bot_channel_telegram_enabled = COALESCE(?, bot_channel_telegram_enabled),
         bot_channel_sheets_enabled = COALESCE(?, bot_channel_sheets_enabled),
         bot_channel_webhook_enabled = COALESCE(?, bot_channel_webhook_enabled),
         bot_channel_email_enabled = COALESCE(?, bot_channel_email_enabled),
         bot_work_hours = COALESCE(?, bot_work_hours),
         bot_reminders_enabled = COALESCE(?, bot_reminders_enabled),
         bot_max_daily = COALESCE(?, bot_max_daily),
         updated_at = unixepoch()
       WHERE client_id = ?`
    ).bind(
      b.bot_greeting_ru ?? null,
      b.bot_prompt_ru ?? null,
      b.bot_prompt_en ?? null,
      b.bot_ai_provider ?? null,
      b.bot_ai_api_key ?? null,
      b.bot_ai_base_url ?? null,
      b.bot_telegram_token ?? null,
      b.bot_telegram_admin_id ?? null,
      b.bot_industry ?? null,
      b.bot_services ?? null,
      b.bot_sheets_url ?? null,
      b.bot_webhook_url ?? null,
      b.bot_webhook_secret ?? null,
      b.bot_notification_email ?? null,
      b.bot_channel_telegram_enabled !== undefined ? (b.bot_channel_telegram_enabled ? 1 : 0) : null,
      b.bot_channel_sheets_enabled !== undefined ? (b.bot_channel_sheets_enabled ? 1 : 0) : null,
      b.bot_channel_webhook_enabled !== undefined ? (b.bot_channel_webhook_enabled ? 1 : 0) : null,
      b.bot_channel_email_enabled !== undefined ? (b.bot_channel_email_enabled ? 1 : 0) : null,
      b.bot_work_hours ?? null,
      b.bot_reminders_enabled !== undefined ? (b.bot_reminders_enabled ? 1 : 0) : null,
      b.bot_max_daily ?? null,
      b.client_id
    ).run();

    // ============================================
    // ⚠️ НОВОЕ: Уведомляем VPS, если изменилась галочка Business или сам бот
    // ============================================
    const businessChanged = b.business_bot_enabled !== undefined && before &&
      (b.business_bot_enabled ? 1 : 0) !== before.business_bot_enabled;

    const botChanged = b.bot_enabled !== undefined && before &&
      (b.bot_enabled ? 1 : 0) !== before.bot_enabled;

    if ((businessChanged || botChanged) && env.VPS_RELOAD_URL && env.BOT_SECRET) {
      try {
        await fetch(env.VPS_RELOAD_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Secret': env.BOT_SECRET
          },
          body: JSON.stringify({ client_id: b.client_id })
        });
        console.log('VPS reloaded due to settings change');
      } catch (e) {
        console.error('VPS reload failed:', e);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

function getPayload(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch (e) {
    return null;
  }
}