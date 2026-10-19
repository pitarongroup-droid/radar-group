// ============================================
// POST /api/bot/lead — пометить лид + уведомить (VPS-бот)
// Авторизация: X-Bot-Secret
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { dialog_id, client_id, contact, user_name, summary } = body;

    if (!dialog_id || !client_id || !contact) {
      return Response.json({ ok: false, error: 'dialog_id, client_id, contact required' }, { status: 400 });
    }

    // 1. Обновляем диалог → ставим статус "Лид" (is_lead = 1)
    await env.radar_group_db.prepare(
      `UPDATE dialogs
       SET is_lead = 1, user_contact = ?, user_name = COALESCE(?, user_name), lead_data = ?
       WHERE id = ? AND client_id = ?`
    ).bind(
      contact,
      user_name || null,
      JSON.stringify({ contact, user_name: user_name || null, summary: summary || null, timestamp: new Date().toISOString() }),
      dialog_id,
      client_id
    ).run();

    // 2. Записываем событие в лог (нужно для статистики и отчётов)
    await env.radar_group_db.prepare(
      `INSERT INTO events (id, client_id, event_name, dialog_id, metadata)
       VALUES (?, ?, 'lead.created', ?, ?)`
    ).bind(
      'evt_' + crypto.randomUUID().slice(0, 8),
      client_id,
      dialog_id,
      JSON.stringify({ contact, source: 'telegram_bot' })
    ).run();

    // 3. Получаем настройки клиента — куда отправлять уведомления
    const settings = await env.radar_group_db.prepare(
      `SELECT bot_telegram_token, bot_telegram_admin_id,
              bot_channel_sheets_enabled, bot_sheets_url,
              bot_channel_webhook_enabled, bot_webhook_url, bot_webhook_secret,
              bot_channel_email_enabled, bot_notification_email
       FROM settings WHERE client_id = ?`
    ).bind(client_id).first();

    if (!settings) {
      return Response.json({ ok: true, notified: [] });
    }

    const client = await env.radar_group_db.prepare(
      `SELECT name FROM clients WHERE id = ?`
    ).bind(client_id).first();

    const leadText =
      `🔥 НОВЫЙ ЛИД (Telegram-бот)\n\n` +
      `📞 Контакт: ${contact}\n` +
      `👤 Имя: ${user_name || '—'}\n` +
      `🏢 Клиент: ${client?.name || '—'}\n` +
      `📝 ${summary ? `Сводка: ${summary}\n` : ''}` +
      `🕐 ${new Date().toLocaleString('ru-RU')}`;

    const notified = [];

    // Отправка в Telegram
    if (settings.bot_telegram_token && settings.bot_telegram_admin_id) {
      try {
        await fetch(`https://api.telegram.org/bot${settings.bot_telegram_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.bot_telegram_admin_id,
            text: leadText
          })
        });
        notified.push('telegram');
      } catch (e) { console.error('TG lead error:', e); }
    }

    // Отправка в Google Sheets
    if (settings.bot_channel_sheets_enabled === 1 && settings.bot_sheets_url) {
      try {
        await fetch(settings.bot_sheets_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'telegram_bot',
            name: user_name || '',
            phone: contact,
            client: client?.name || '',
            message: summary || '',
            date: new Date().toISOString()
          })
        });
        notified.push('sheets');
      } catch (e) { console.error('Sheets lead error:', e); }
    }

    // Отправка в Webhook (CRM)
    if (settings.bot_channel_webhook_enabled === 1 && settings.bot_webhook_url) {
      try {
        const payload = JSON.stringify({
          event: 'lead.created',
          source: 'telegram_bot',
          timestamp: new Date().toISOString(),
          client_id,
          dialog_id,
          lead: { contact, user_name, summary }
        });
        await fetch(settings.bot_webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Radar-Signature': await hmacSign(payload, settings.bot_webhook_secret || '')
          },
          body: payload
        });
        notified.push('webhook');
      } catch (e) { console.error('Webhook lead error:', e); }
    }

    // Email (заглушка)
    if (settings.bot_channel_email_enabled === 1 && settings.bot_notification_email) {
      console.log('Email would be sent to:', settings.bot_notification_email);
      notified.push('email');
    }

    return Response.json({ ok: true, notified });

  } catch (err) {
    console.error('Bot lead error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
      'Access-Control-Max-Age': '86400'
    }
  });
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}