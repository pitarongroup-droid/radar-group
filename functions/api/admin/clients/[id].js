// ============================================
// /api/admin/clients/:id
// GET    — карточка клиента + настройки
// PUT    — обновить данные + доступ + авто-reload VPS
// DELETE — удалить клиента + авто-delete webhook
// ⚠️ Проверяет role = admin
// ============================================

export async function onRequestGet({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const client = await env.radar_group_db.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(params.id).first();

    if (!client) {
      return Response.json(
        { ok: false, error: { ru: 'Клиент не найден', en: 'Client not found' } },
        { status: 404 }
      );
    }

    const settings = await env.radar_group_db.prepare(
      'SELECT * FROM settings WHERE client_id = ?'
    ).bind(params.id).first();

    return Response.json({ ok: true, client, settings: settings || {} });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    const b = await request.json();

    if ('account_status' in b) {
      if (!['pending', 'approved', 'suspended'].includes(b.account_status)) {
        return Response.json(
          { ok: false, error: { ru: 'Неверный статус', en: 'Invalid status' } },
          { status: 400 }
        );
      }
    }

    // Сохранённое состояние до апдейта
    const before = await env.radar_group_db.prepare(
      `SELECT c.account_status, s.bot_enabled, s.bot_telegram_token
       FROM clients c LEFT JOIN settings s ON s.client_id = c.id
       WHERE c.id = ?`
    ).bind(params.id).first();

    await env.radar_group_db.prepare(
      `UPDATE clients SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         site_url = COALESCE(?, site_url),
         language = COALESCE(?, language),
         currency = COALESCE(?, currency),
         plan = COALESCE(?, plan),
         status = COALESCE(?, status),
         account_status = COALESCE(?, account_status),
         updated_at = unixepoch()
       WHERE id = ?`
    ).bind(
      b.name || null,
      b.email ? b.email.toLowerCase() : null,
      b.phone || null,
      b.company || null,
      b.site_url || null,
      b.language || null,
      b.currency || null,
      b.plan || null,
      b.status || null,
      b.account_status || null,
      params.id
    ).run();

    const settingsUpdates = {};
    if ('widget_enabled' in b) settingsUpdates.widget_enabled = b.widget_enabled ? 1 : 0;
    if ('bot_enabled' in b) settingsUpdates.bot_enabled = b.bot_enabled ? 1 : 0;

    if (Object.keys(settingsUpdates).length > 0) {
      const fields = Object.keys(settingsUpdates);
      const values = Object.values(settingsUpdates);
      const setClause = fields.map(f => `${f} = ?`).join(', ');

      await env.radar_group_db.prepare(
        `UPDATE settings SET ${setClause}, updated_at = unixepoch() WHERE client_id = ?`
      ).bind(...values, params.id).run();
    }

    // ⚠️ Авто-уведомление VPS: включили/выключили бота
    try {
      if (env.VPS_RELOAD_URL && env.BOT_SECRET) {
        const botEnabledChanged = before && settingsUpdates.bot_enabled !== undefined
          && before.bot_enabled !== settingsUpdates.bot_enabled;

        const statusChanged = b.account_status && before
          && before.account_status !== b.account_status;

        if (botEnabledChanged || statusChanged) {
          await fetch(env.VPS_RELOAD_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Bot-Secret': env.BOT_SECRET
            },
            body: JSON.stringify({ client_id: params.id })
          }).catch(e => console.error('VPS reload failed:', e));
        }
      }
    } catch (e) {
      console.error('VPS notify error:', e);
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestDelete({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    // Удаляем webhook у Telegram, если есть токен
    try {
      const s = await env.radar_group_db.prepare(
        `SELECT bot_telegram_token FROM settings WHERE client_id = ?`
      ).bind(params.id).first();

      if (s && s.bot_telegram_token) {
        await fetch(
          `https://api.telegram.org/bot${s.bot_telegram_token}/deleteWebhook`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drop_pending_updates: true })
          }
        ).catch(e => console.error('Delete webhook failed:', e));
      }
    } catch (e) {
      console.error('Webhook cleanup error:', e);
    }

    await env.radar_group_db.batch([
      env.radar_group_db.prepare('DELETE FROM settings WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM users WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM clients WHERE id = ?').bind(params.id)
    ]);

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