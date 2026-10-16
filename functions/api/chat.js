// ============================================
// /api/chat — универсальный чат с AI
// Поддержка: OpenAI / ProxyAPI / Claude / Gemini / DeepSeek
// Отправка лидов: Telegram / Google Sheets / Webhook (CRM) / Email
// ============================================

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

// ============================================
// ДЕМО-ПРОМПТ ДЛЯ САЙТА RADAR GROUP (виджет на radar-group.org)
// ============================================
const FALLBACK_PROMPT_RU = `Ты — опытный ИИ-менеджер компании Radar Group. Живой продавец-консультант. Ты НЕ скрываешь, что ты ИИ.

НАШИ УСЛУГИ:

1. ВИДЖЕТ НА САЙТ — от 200 BYN/мес
   Что входит:
   — ИИ-менеджер в виде чата на вашем сайте
   — Приём заявок 24/7
   — Отработка возражений
   — 4 стадии дожима
   — Уведомления в Telegram, Email, Google Sheets, CRM
   — Личный кабинет клиента
   — Удобная настройка промпта
   — Интеграция с Bitrix24 / amoCRM / HubSpot

2. РАЗРАБОТКА САЙТА:
   — Одностраничный (лендинг) — от 500 BYN
   — Многостраничный (корпоративный) — от 1500 BYN
   — Базовые SEO-настройки включены
   — Подключение Google Analytics — за доп. плату
   — Подключение Яндекс.Метрики — за доп. плату
   — Настройка конверсии на сайте — за доп. плату

3. КОМПЛЕКСНЫЕ РЕШЕНИЯ:
   — Сайт + виджет — скидка 15%
   — Telegram-бот + виджет — отдельный тариф

ЖЁСТКИЕ ПРАВИЛА ФОРМАТА:
1. Каждое сообщение — РОВНО 2 блока.
2. Между блоками — ПУСТАЯ СТРОКА.
3. Каждый блок — 1 короткое предложение (до 12 слов).
4. Каждое сообщение ЗАКАНЧИВАЙ ВОПРОСОМ.
5. Один смайл на сообщение.

ЧТО УЗНАТЬ О КЛИЕНТЕ:
— Ниша (чем занимается)
— Есть ли сайт
— Нужен ли виджет, сайт, бот или всё вместе
— Канал лидов (Telegram, Email, CRM)
— Сколько заявок в день

ОТРАБОТКА ВОЗРАЖЕНИЙ:
— «Дорого» → «Понимаю 🙂 Виджет — от 200 BYN/мес, сайт — от 500 BYN. Что важнее для вас?»
— «Подумаю» → «Конечно 🙂 Если появятся вопросы — я здесь.»
— «Уже есть сайт» → «Отлично! Тогда вам нужен виджет — от 200 BYN/мес.»

ТОН: живой, дружелюбный, на «Вы».`;

const FALLBACK_PROMPT_EN = `You are an experienced AI Manager at Radar Group. A live sales consultant. You don't hide that you are AI.

OUR SERVICES:

1. WEBSITE WIDGET — from 200 BYN/month
   What's included:
   — AI manager as a chat on your website
   — 24/7 lead handling
   — Objection handling
   — 4 follow-up stages
   — Notifications to Telegram, Email, Google Sheets, CRM
   — Client dashboard
   — Easy prompt setup
   — Bitrix24 / amoCRM / HubSpot integration

2. WEBSITE DEVELOPMENT:
   — One-page (landing) — from 500 BYN
   — Multi-page (corporate) — from 1500 BYN
   — Basic SEO included
   — Google Analytics setup — extra
   — Yandex.Metrica setup — extra
   — Site conversion setup — extra

3. BUNDLES:
   — Website + widget — 15% off
   — Telegram bot + widget — separate plan

STRICT FORMAT RULES:
1. Each message — EXACTLY 2 blocks.
2. Empty line between blocks.
3. Each block — 1 short sentence (up to 12 words).
4. END EACH message with a QUESTION.
5. One emoji per message.

TONE: live, friendly, polite.`;

// ============================================
// АВТО-ПРОМПТ ДЛЯ КЛИЕНТСКИХ ВИДЖЕТОВ
// ============================================
function buildAutoPrompt({ clientName, industry, services, lang }) {
  if (lang === 'en') {
    return `You are a manager at "${clientName}".
${industry ? `Industry: ${industry}.` : ''}
${services ? `Services:\n${services}` : ''}

Your task:
1. Greet the client warmly.
2. Learn what they need.
3. Collect their contact for our manager.

FORMAT:
- Each message — 2 short blocks.
- Empty line between blocks.
- End each message with a question.
- One emoji per message.

TONE: live, friendly, polite.`;
  }

  return `Ты — менеджер компании "${clientName}".
${industry ? `Сфера: ${industry}.` : ''}
${services ? `Услуги:\n${services}` : ''}

Твоя задача:
1. Поздороваться с клиентом.
2. Узнать, что ему нужно.
3. Собрать контакт для связи с менеджером.

ФОРМАТ:
— Каждое сообщение — 2 коротких блока.
— Между блоками — пустая строка.
— Каждое сообщение заканчивай вопросом.
— Один смайл на сообщение.

ТОН: живой, дружелюбный, на «Вы».`;
}

// ============================================
// CORS preflight
// ============================================
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ============================================
// POST — основной обработчик
// ============================================
export async function onRequestPost(context) {
  const { request, env } = context;
  const BOT_TOKEN = env.BOT_TOKEN;
  const CHAT_ID = env.CHAT_ID;
  const FALLBACK_AI_KEY = env.OPENAI_API_KEY;

  try {
    const body = await request.json();
    const { messages, contact, history, lang, api_key, dialog_id } = body;
    const langSafe = lang === 'en' ? 'en' : 'ru';

    // === RATE LIMIT ===
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const record = RATE_LIMIT_MAP.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }
    record.count++;
    RATE_LIMIT_MAP.set(ip, record);

    if (record.count > RATE_LIMIT_MAX) {
      return jsonResponse(
        { error: langSafe === 'en'
          ? 'Too many messages. Please wait a couple of minutes 🙂'
          : 'Слишком много сообщений. Подождите пару минут 🙂' },
        429
      );
    }

    // === НАЙТИ КЛИЕНТА ===
    let client = null;
    let settings = null;
    const isDemo = !api_key;

    if (api_key) {
      client = await env.radar_group_db.prepare(
        `SELECT id, name, status FROM clients WHERE api_key = ?`
      ).bind(api_key).first();

      if (!client) {
        return jsonResponse({ error: 'Неверный API-ключ' }, 401);
      }
      if (client.status === 'suspended') {
        return jsonResponse({ error: 'Виджет отключён' }, 403);
      }

      settings = await env.radar_group_db.prepare(
        `SELECT * FROM settings WHERE client_id = ?`
      ).bind(client.id).first();
    }

    // ============================================
    // ЛИД — отправка по всем включённым каналам
    // ============================================
    if (contact) {
      if (dialog_id && !isDemo) {
        await env.radar_group_db.prepare(
          `UPDATE dialogs SET is_lead = 1, user_contact = ?, lead_data = ? WHERE id = ?`
        ).bind(
          contact,
          JSON.stringify({ contact, lang: langSafe, timestamp: new Date().toISOString() }),
          dialog_id
        ).run();

        await env.radar_group_db.prepare(
          `INSERT INTO events (id, client_id, event_name, dialog_id, language, metadata)
           VALUES (?, ?, 'lead.created', ?, ?, ?)`
        ).bind(
          'evt_' + crypto.randomUUID().slice(0, 8),
          client.id, dialog_id, langSafe,
          JSON.stringify({ contact })
        ).run();
      }

      const dialogLog = (history || [])
        .map(m => `• ${m.role === 'user' ? 'Клиент' : 'Бот'}: ${String(m.content).slice(0, 200)}`)
        .join('\n');

      const leadText = `🔥 НОВЫЙ ЛИД\n\n` +
        `📞 Контакт: ${contact}\n` +
        `🏢 Клиент: ${client?.name || 'Radar Group (демо)'}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}\n\n` +
        `📝 Диалог:\n${dialogLog.slice(0, 3000)}`;

      let sent = false;

      // 1. TELEGRAM
      const canTelegram = settings?.channel_telegram_enabled && settings?.admin_allow_telegram;
      if (canTelegram && settings?.telegram_token && settings?.telegram_admin_id) {
        try {
          await fetch(`https://api.telegram.org/bot${settings.telegram_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: settings.telegram_admin_id,
              text: leadText
            })
          });
          sent = true;
        } catch (e) { console.error('TG error:', e); }
      }

      // 2. GOOGLE SHEETS
      const canSheets = settings?.channel_sheets_enabled && settings?.admin_allow_sheets;
      if (canSheets && settings?.sheets_url) {
        try {
          await fetch(settings.sheets_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: client?.name || 'Клиент',
              phone: contact,
              message: history?.slice(-1)[0]?.content || '',
              client: client?.name || '',
              date: new Date().toISOString()
            })
          });
          sent = true;
        } catch (e) { console.error('Sheets error:', e); }
      }

      // 3. WEBHOOK (CRM)
      const canWebhook = settings?.channel_webhook_enabled && settings?.admin_allow_webhook;
      if (canWebhook && settings?.webhook_url) {
        try {
          const payload = JSON.stringify({
            event: 'lead.created',
            lang: langSafe,
            timestamp: new Date().toISOString(),
            client_id: client.id,
            dialog_id: dialog_id,
            source: 'widget',
            lead: { contact, message: history?.slice(-1)[0]?.content || '' }
          });
          await fetch(settings.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Radar-Signature': await hmacSign(payload, settings.webhook_secret || '')
            },
            body: payload
          });
          sent = true;
        } catch (e) { console.error('Webhook error:', e); }
      }

      // 4. EMAIL (заготовка)
      const canEmail = settings?.channel_email_enabled && settings?.admin_allow_email;
      if (canEmail && settings?.notification_email) {
        console.log('Email would be sent to:', settings.notification_email);
      }

      // FALLBACK — если ни один канал не сработал → вам
      if (!sent && BOT_TOKEN && CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: leadText })
        }).catch(() => {});
      }

      return jsonResponse({ ok: true });
    }

    // ============================================
    // ВЫБОР ПРОМПТА
    // ============================================
    let SYSTEM_PROMPT;

    if (isDemo) {
      SYSTEM_PROMPT = langSafe === 'en' ? FALLBACK_PROMPT_EN : FALLBACK_PROMPT_RU;
    } else {
      const manualPrompt = langSafe === 'en' ? settings?.prompt_en : settings?.prompt_ru;

      if (manualPrompt && manualPrompt.trim().length >= 200) {
        SYSTEM_PROMPT = manualPrompt.trim();
      } else {
        SYSTEM_PROMPT = buildAutoPrompt({
          clientName: client?.name || 'наша компания',
          industry: settings?.industry,
          services: settings?.services,
          lang: langSafe
        });
      }
    }

    // ============================================
    // AI-КЛЮЧ
    // ============================================
    const AI_KEY = isDemo ? FALLBACK_AI_KEY : (settings?.ai_api_key || null);

    if (!AI_KEY) {
      return jsonResponse({
        error: langSafe === 'en'
          ? 'AI key is not configured. Contact the administrator.'
          : 'AI-ключ не настроен. Обратитесь к администратору.'
      }, 503);
    }

    // Создать диалог, если нужно
    let activeDialogId = dialog_id;
    if (!activeDialogId && !isDemo) {
      activeDialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);
      await env.radar_group_db.prepare(
        `INSERT INTO dialogs (id, client_id, channel, status)
         VALUES (?, ?, 'widget', 'active')`
      ).bind(activeDialogId, client.id).run();
    }

    // === УНИВЕРСАЛЬНЫЙ ВЫЗОВ AI ===
    const provider = isDemo ? 'proxyapi' : (settings?.ai_provider || 'proxyapi');
    const baseUrl = isDemo ? null : (settings?.ai_base_url || null);

    const reply = await callAI({
      provider,
      apiKey: AI_KEY,
      baseUrl,
      systemPrompt: SYSTEM_PROMPT,
      messages: messages || []
    });

    // === ЗАПИСЬ В БД ===
    if (activeDialogId && !isDemo) {
      const lastUserMsg = messages?.[messages.length - 1];

      if (lastUserMsg?.content) {
        await env.radar_group_db.prepare(
          `INSERT INTO messages (id, dialog_id, role, content)
           VALUES (?, ?, 'user', ?)`
        ).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, lastUserMsg.content).run();
      }

      await env.radar_group_db.prepare(
        `INSERT INTO messages (id, dialog_id, role, content, tokens_used, cost_usd)
         VALUES (?, ?, 'assistant', ?, 0, 0)`
      ).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, reply).run();
    }

    const contactReady = /инженер|engineer|менеджер|manager/i.test(reply);

    return jsonResponse({
      reply: reply.trim(),
      contactReady,
      dialog_id: activeDialogId
    });

  } catch (err) {
    console.error('Chat error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

// ============================================
// УНИВЕРСАЛЬНЫЙ ВЫЗОВ AI
// ============================================
async function callAI({ provider, apiKey, baseUrl, systemPrompt, messages }) {
  if (provider === 'claude') {
    return await callClaude({ apiKey, baseUrl, systemPrompt, messages });
  }
  if (provider === 'gemini') {
    return await callGemini({ apiKey, baseUrl, systemPrompt, messages });
  }
  return await callOpenAI({ provider, apiKey, baseUrl, systemPrompt, messages });
}

// --- OpenAI-совместимые ---
async function callOpenAI({ provider, apiKey, baseUrl, systemPrompt, messages }) {
  let url = baseUrl;
  if (!url) {
    if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
    else if (provider === 'deepseek') url = 'https://api.deepseek.com/v1/chat/completions';
    else url = 'https://api.proxyapi.ru/v1/chat/completions';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 200,
      frequency_penalty: 0.6,
      presence_penalty: 0.6
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI error');

  return data.choices[0].message.content;
}

// --- Anthropic Claude ---
async function callClaude({ apiKey, baseUrl, systemPrompt, messages }) {
  const url = baseUrl || 'https://api.anthropic.com/v1/messages';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: systemPrompt,
      messages: messages
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude error');

  return data.content[0].text;
}

// --- Google Gemini ---
async function callGemini({ apiKey, baseUrl, systemPrompt, messages }) {
  const defaultUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const url = baseUrl ? `${baseUrl}?key=${apiKey}` : defaultUrl;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini error');

  return data.candidates[0].content.parts[0].text;
}

// --- HMAC для webhook ---
async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}