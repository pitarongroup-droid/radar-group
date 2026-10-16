// ============================================
// GET /api/settings — получить настройки клиента
// PUT /api/settings — сохранить настройки клиента
// Проверяет account_status + widget_enabled/bot_enabled
// ============================================

const CLIENT_FIELDS_WIDGET = [
  'prompt_ru', 'prompt_en',
  'ai_provider', 'ai_api_key', 'ai_base_url',
  'industry', 'services',
  'widget_title_ru', 'widget_title_en',
  'widget_welcome_ru', 'widget_welcome_en',
  'widget_color', 'widget_position',
  'telegram_token', 'telegram_admin_id',
  'sheets_url', 'webhook_url', 'webhook_secret',
  'notification_email', 'max_daily_requests',
  'channel_telegram_enabled',
  'channel_sheets_enabled',
  'channel_webhook_enabled',
  'channel_email_enabled'
];

const CLIENT_FIELDS_BOT = [
  'bot_prompt_ru', 'bot_prompt_en',
  'bot_ai_provider', 'bot_ai_api_key', 'bot_ai_base_url',
  'bot_industry', 'bot_services',
  'bot_telegram_token', 'bot_telegram_admin_id',
  'bot_sheets_url', 'bot_webhook_url', 'bot_webhook_secret',
  'bot_notification_email',
  'bot_channel_telegram_enabled',
  'bot_channel_sheets_enabled',
  'bot_channel_webhook_enabled',
  'bot_channel_email_enabled',
  'bot_work_hours', 'bot_reminders_enabled', 'bot_max_daily'
];

const ADMIN_ONLY_FIELDS = [
  'account_status',
  'widget_enabled',
  'bot_enabled',
  'admin_allow_telegram',
  'admin_allow_sheets',
  'admin_allow_webhook',
  'admin_allow_email',
  'use_radar_ai_key_widget',
  'use_radar_ai_key_bot'
];

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromToken(request, env);
    if (!user) return error('Не авторизован', 'Unauthorized', 401);

    const client = await env.radar_group_db.prepare(
      'SELECT account_status FROM clients WHERE id = ?'
    ).bind(user.clientId).first();

    if (!client) return error('Клиент не найден', 'Client not found', 404);

    if (client.account_status !== 'approved') {
      return Response.json({
        ok: false,
        error: {
          ru: 'Аккаунт на проверке. Настройки недоступны.',
          en: 'Account pending approval. Settings unavailable.'
        },
        account_status: client.account_status
      }, { status: 403 });
    }

    const settings = await env.radar_group_db.prepare(
      `SELECT * FROM settings WHERE client_id = ?`
    ).bind(user.clientId).first();

    if (!settings) return error('Настройки не найдены', 'Settings not found', 404);

    return Response.json({ ok: true, settings });

  } catch (err) {
    console.error('Settings GET error:', err);
    return error('Ошибка сервера', 'Server error', 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromToken(request, env);
    if (!user) return error('Не авторизован', 'Unauthorized', 401);

    const client = await env.radar_group_db.prepare(
      'SELECT account_status FROM clients WHERE id = ?'
    ).bind(user.clientId).first();

    if (!client || client.account_status !== 'approved') {
      return Response.json({
        ok: false,
        error: {
          ru: 'Аккаунт на проверке. Сохранение недоступно.',
          en: 'Account pending approval. Saving unavailable.'
        },
        account_status: client ? client.account_status : 'unknown'
      }, { status: 403 });
    }

    const current = await env.radar_group_db.prepare(
      `SELECT widget_enabled, bot_enabled FROM settings WHERE client_id = ?`
    ).bind(user.clientId).first();

    if (!current) return error('Настройки не найдены', 'Settings not found', 404);

    const body = await request.json();
    const clean = {};

    for (const key of Object.keys(body)) {
      if (ADMIN_ONLY_FIELDS.includes(key)) continue;
      clean[key] = body[key];
    }

    const allowed = [];
    if (current.widget_enabled === 1) allowed.push(...CLIENT_FIELDS_WIDGET);
    if (current.bot_enabled === 1) allowed.push(...CLIENT_FIELDS_BOT);

    const filtered = {};
    for (const key of Object.keys(clean)) {
      if (allowed.includes(key)) {
        filtered[key] = clean[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return error('Нет данных для сохранения', 'No data to save', 400);
    }

    if (filtered.prompt_ru !== undefined && filtered.prompt_ru) {
      const len = String(filtered.prompt_ru).length;
      if (len < 200 || len > 4000) {
        return error('Промпт: 200–4000 символов', 'Prompt: 200–4000 chars', 400);
      }
    }
    if (filtered.prompt_en !== undefined && filtered.prompt_en) {
      const len = String(filtered.prompt_en).length;
      if (len < 200 || len > 4000) {
        return error('Prompt EN: 200–4000 chars', 'Prompt EN: 200–4000 chars', 400);
      }
    }
    if (filtered.bot_prompt_ru !== undefined && filtered.bot_prompt_ru) {
      const len = String(filtered.bot_prompt_ru).length;
      if (len < 200 || len > 8000) {
        return error('Промпт бота: 200–8000 символов', 'Bot prompt: 200–8000 chars', 400);
      }
    }
    if (filtered.bot_prompt_en !== undefined && filtered.bot_prompt_en) {
      const len = String(filtered.bot_prompt_en).length;
      if (len < 200 || len > 8000) {
        return error('Bot prompt EN: 200–8000 chars', 'Bot prompt EN: 200–8000 chars', 400);
      }
    }

    const fields = Object.keys(filtered);
    const values = Object.values(filtered);
    const setClause = fields.map(f => `${f} = ?`).join(', ');

    await env.radar_group_db.prepare(
      `UPDATE settings SET ${setClause}, updated_at = unixepoch()
       WHERE client_id = ?`
    ).bind(...values, user.clientId).run();

    return Response.json({ ok: true, updated: fields.length });

  } catch (err) {
    console.error('Settings PUT error:', err);
    return error('Ошибка сервера', 'Server error', 500);
  }
}

function error(ru, en, status = 400) {
  return Response.json({ ok: false, error: { ru, en } }, { status });
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function getUserFromToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  const sigBytes = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes, new TextEncoder().encode(data)
  );
  if (!valid) return null;

  try {
    const payloadObj = JSON.parse(base64UrlDecode(payload));
    if (payloadObj.exp && payloadObj.exp < Math.floor(Date.now() / 1000)) return null;
    return payloadObj;
  } catch {
    return null;
  }
}