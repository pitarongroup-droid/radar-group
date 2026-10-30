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

// --- ФУНКЦИИ УМНОГО ПАРСИНГА ---
function extractCleanPhone(text) {
  const match = text.match(/(\+?\d[\d\s\-\(\)]{8,18}\d)/);
  if (match) {
    let digits = match[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      if (digits.length === 12 && digits.startsWith('375')) {
        return `+375 (${digits.slice(3,5)}) ${digits.slice(5,8)}-${digits.slice(8,10)}-${digits.slice(10,12)}`;
      }
      if (digits.length === 11 && digits.startsWith('7')) {
        return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9,11)}`;
      }
      return `+${digits}`;
    }
  }
  return null;
}

function extractNameFromText(text, history) {
  const match = text.match(/(?:меня зовут|моё имя|мое имя|я)\s+([А-ЯЁA-Z][а-яёa-z]+)/i);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  }
  
  const cleanText = text.trim();
  if (cleanText.split(/\s+/).length === 1 && /^[А-ЯЁA-Z][а-яёa-z]+$/i.test(cleanText)) {
    return cleanText.charAt(0).toUpperCase() + cleanText.slice(1).toLowerCase();
  }

  if (history && history.length > 0) {
    for (const msg of history) {
      if (msg.role === 'user') {
        const m = msg.content.match(/(?:меня зовут|моё имя|мое имя|я)\s+([А-ЯЁA-Z][а-яёa-z]+)/i);
        if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      }
    }
  }
  return null;
}
// -------------------------------

const FALLBACK_PROMPT_RU = `Ты — опытный ИИ-менеджер компании Radar Group. Живой продавец-консультант. Ты НЕ скрываешь, что ты ИИ.

🚨 ЖЕСТКОЕ ПРАВИЛО: КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать цены! Используй ТОЛЬКО те цены, которые указаны ниже. Если тебя спрашивают про услугу, которой нет в списке, скажи: "Эту информацию уточнит менеджер".

🚨 ПРАВИЛА ПРОДАЖИ:
1. НЕ СПРАШИВАЙ «Что вам нужно?» или «Какая услуга вас интересует?». Клиент может не знать о наших возможностях. Твоя задача — САМОМУ презентовать услуги.
2. ОЗВУЧИВАЙ ЦЕНУ сразу, когда рассказываешь про услугу. Например: «У нас есть тариф Старт за 200 BYN — это умный виджет на сайт».
3. НЕ ПРОСИ КОНТАКТ СРАЗУ. Сначала презентуй услугу, ответь на вопросы, и только потом мягко предложи: «Могу передать вас менеджеру для детального расчета».

НАШИ УСЛУГИ:

1. ИИ-МЕНЕДЖЕР (подписка):
   — СТАРТ — 200 BYN/мес: ИИ-виджет на сайт, обучение ИИ под ваш продукт, передача заявок в Telegram, отработка возражений.
   — БИЗНЕС — 350 BYN/мес: Всё из «Старт» + Telegram-бот, передача в CRM и Google Sheets, 4 стадии дожима, настройка за 1-2 дня.
   — ПРЕМИУМ — 500 BYN/мес: Всё из «Бизнес» + Telegram Business (ответы от вашего имени), прямая интеграция с CRM, личный менеджер, приоритетная поддержка.

2. РАЗРАБОТКА САЙТОВ (разовая услуга):
   — Продающий лендинг или многостраничный сайт под ключ.
   — Стоимость: от 500 BYN (точная цена зависит от задачи).
   — Что входит: адаптивность, высокая скорость, базовое SEO, интеграция с ИИ-виджетом.

ЖЁСТКИЕ ПРАВИЛА ФОРМАТА:
1. Каждое сообщение — РОВНО 2 блока.
2. Между блоками — ПУСТАЯ СТРОКА.
3. Каждый блок — 1-2 коротких предложения.
4. Каждое сообщение ЗАКАНЧИВАЙ ВОПРОСОМ (вовлекай в диалог).
5. Один смайл на сообщение.

ЧТО УЗНАТЬ В ПРОЦЕССЕ (не задавай это списком, спрашивай по одному вопросу):
— Чем занимается клиент.
— Есть ли у него сайт.
— Нужен ли Telegram-бот или CRM.

ОТРАБОТКА ВОЗРАЖЕНИЙ:
— «Дорого» → «Понимаю 🙂 Тариф Старт — 200 BYN/мес. Он окупается с первой заявки.»
— «Подумаю» → «Конечно 🙂 Если появятся вопросы — я здесь.»
— «Уже есть сайт» → «Отлично! Тогда вам подойдет виджет Старт — от 200 BYN.»
— «Нужен сайт» → «Мы разрабатываем сайты под ключ — от 500 BYN. Обсудим задачу?»

ТОН: живой, дружелюбный, на «Вы».`;

const FALLBACK_PROMPT_EN = `You are an experienced AI Manager at Radar Group. A live sales consultant. You don't hide that you are AI.

🚨 STRICT RULE: DO NOT invent prices! Use ONLY the prices listed below. If you don't know a price, say "The manager will clarify".

🚨 SALES RULES:
1. DO NOT ASK "What do you need?". The client might not know our capabilities. Your task is to PITCH the services yourself.
2. MENTION THE PRICE immediately when describing a service. E.g., "Our Start plan is 200 BYN/month for an AI widget".
3. DO NOT RUSH FOR CONTACTS. Pitch the service, answer questions, and only then softly suggest: "I can connect you with a manager for a detailed calculation."

OUR SERVICES:
1. AI MANAGER (subscription):
   — START — 200 BYN/month: AI widget for your website, AI training, Telegram leads, objection handling.
   — BUSINESS — 350 BYN/month: Everything in Start + Telegram bot, CRM & Google Sheets, 4 follow-up stages, setup in 1-2 days.
   — PREMIUM — 500 BYN/month: Everything in Business + Telegram Business (reply as you), direct CRM integration, personal manager, priority support.
2. WEBSITE DEVELOPMENT (one-time):
   — Landing page or multi-page website, turnkey.
   — Price: from 500 BYN (depends on the task).
   — Includes: responsive design, high speed, basic SEO, AI widget integration.

STRICT FORMAT RULES:
1. Each message — EXACTLY 2 blocks.
2. Empty line between blocks.
3. Each block — 1-2 short sentences.
4. END EACH message with a QUESTION.
5. One emoji per message.

TONE: live, friendly, polite.`;

function buildAutoPrompt({ clientName, industry, services, lang }) {
  if (lang === 'en') {
    return `You are a manager at "${clientName}".
${industry ? `Industry: ${industry}.` : ''}
${services ? `Services:\n${services}` : ''}

🚨 DO NOT invent prices. If you don't know a price, say "The manager will clarify".
🚨 DO NOT ask "What do you need?". Instead, actively present the services listed above. Mention prices as you describe them.
🚨 DO NOT ask for contacts immediately. Pitch first, then softly offer to connect with a manager.

Your task:
1. Greet the client warmly.
2. Present the services and benefits.
3. Answer questions and smoothly lead to contact collection.

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

🚨 КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать цены. Если ты не знаешь цену, скажи "Эту информацию уточнит менеджер".
🚨 НЕ СПРАШИВАЙ «Что вам нужно?». Вместо этого сам презентуй услуги, перечисленные выше. Озвучивай цены, когда рассказываешь о них.
🚨 НЕ ПРОСИ КОНТАКТ СРАЗУ. Сначала презентуй услугу, и только потом мягко предложи связаться с менеджером.

Твоя задача:
1. Поздороваться с клиентом.
2. Презентовать услуги и их пользу.
3. Ответить на вопросы и плавно подвести к сбору контакта.

ФОРМАТ:
— Каждое сообщение — 2 коротких блока.
— Между блоками — пустая строка.
— Каждое сообщение заканчивай вопросом.
— Один смайл на сообщение.

ТОН: живой, дружелюбный, на «Вы».`;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const BOT_TOKEN = env.BOT_TOKEN;
  const CHAT_ID = env.CHAT_ID;
  const FALLBACK_AI_KEY = env.OPENAI_API_KEY;

  try {
    const body = await request.json();
    const { messages, contact, history, lang, api_key, dialog_id } = body;
    const langSafe = lang === 'en' ? 'en' : 'ru';

    // RATE LIMIT
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
      return jsonResponse({
        error: langSafe === 'en'
          ? 'Too many messages. Please wait a couple of minutes 🙂'
          : 'Слишком много сообщений. Подождите пару минут 🙂'
      }, 429);
    }

    // НАЙТИ КЛИЕНТА
    let client = null;
    let settings = null;
    const isDemo = !api_key;

    if (api_key) {
      client = await env.radar_group_db.prepare(
        `SELECT id, name, status, account_status FROM clients WHERE api_key = ?`
      ).bind(api_key).first();

      if (!client) return jsonResponse({ error: 'Неверный API-ключ' }, 401);
      
      if (client.status === 'suspended' || client.account_status !== 'approved') {
        return jsonResponse({ error: 'Виджет отключён' }, 403);
      }

      settings = await env.radar_group_db.prepare(
        `SELECT * FROM settings WHERE client_id = ?`
      ).bind(client.id).first();

      if (!settings || settings.widget_enabled !== 1) {
        return jsonResponse({ error: 'Услуга виджета не подключена' }, 403);
      }
    }

    // ЛИД
    if (contact) {
      let activeDialogId = dialog_id;
      
      if (!activeDialogId && !isDemo) {
        activeDialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);
        await env.radar_group_db.prepare(
          `INSERT INTO dialogs (id, client_id, channel, status) VALUES (?, ?, 'widget', 'active')`
        ).bind(activeDialogId, client.id).run();
      }

      const dialogLog = (history || [])
        .map(m => `• ${m.role === 'user' ? 'Клиент' : 'Бот'}: ${String(m.content).slice(0, 200)}`)
        .join('\n');

      const cleanPhone = extractCleanPhone(contact);
      const cleanName = extractNameFromText(contact, history) || "Клиент";
      const finalContact = cleanPhone || contact;

      if (activeDialogId && !isDemo) {
        await env.radar_group_db.prepare(
          `UPDATE dialogs SET is_lead = 1, user_contact = ?, user_name = ?, lead_data = ? WHERE id = ?`
        ).bind(
          finalContact,
          cleanName,
          JSON.stringify({ contact: finalContact, lang: langSafe, timestamp: new Date().toISOString() }),
          activeDialogId
        ).run();

        await env.radar_group_db.prepare(
          `INSERT INTO events (id, client_id, event_name, dialog_id, language, metadata)
           VALUES (?, ?, 'lead.created', ?, ?, ?)`
        ).bind(
          'evt_' + crypto.randomUUID().slice(0, 8),
          client.id, activeDialogId, langSafe,
          JSON.stringify({ contact: finalContact })
        ).run();
      }

      const sourceName = client?.name || 'Radar Group (демо)';
      
      const leadText = `🔥 НОВЫЙ ЛИД\n\n` +
        `🌐 Источник: Виджет на сайте "${sourceName}"\n` +
        `📞 Контакт: ${finalContact}\n` +
        `👤 Имя: ${cleanName}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}\n\n` +
        `📝 Диалог:\n${dialogLog.slice(0, 3000)}`;

      let sent = false;

      const canTelegram = settings?.channel_telegram_enabled && settings?.admin_allow_telegram;
      if (canTelegram && settings?.telegram_token && settings?.telegram_admin_id) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${settings.telegram_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: settings.telegram_admin_id, text: leadText })
          });
          const tgData = await tgRes.json();
          if (tgData.ok) sent = true;
          else console.error('TG error:', tgData.description);
        } catch (e) { console.error('TG error:', e); }
      }

      const canSheets = settings?.channel_sheets_enabled && settings?.admin_allow_sheets;
      if (canSheets && settings?.sheets_url) {
        try {
          await fetch(settings.sheets_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: cleanName,
              phone: finalContact,
              message: history?.slice(-1)[0]?.content || '',
              client: sourceName,
              date: new Date().toISOString()
            })
          });
          sent = true;
        } catch (e) { console.error('Sheets error:', e); }
      }

      const canWebhook = settings?.channel_webhook_enabled && settings?.admin_allow_webhook;
      if (canWebhook && settings?.webhook_url) {
        try {
          const payload = JSON.stringify({
            event: 'lead.created', lang: langSafe,
            timestamp: new Date().toISOString(),
            client_id: client.id, dialog_id: activeDialogId, source: 'widget',
            lead: { contact: finalContact, name: cleanName, message: history?.slice(-1)[0]?.content || '' }
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

      if (!sent && BOT_TOKEN && CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: leadText })
        }).catch(() => {});
      }

      return jsonResponse({ ok: true, dialog_id: activeDialogId });
    }

    // ПРОМПТ
    let SYSTEM_PROMPT;

    if (isDemo) {
      SYSTEM_PROMPT = langSafe === 'en' ? FALLBACK_PROMPT_EN : FALLBACK_PROMPT_RU;
    } else {
      const manualPrompt = langSafe === 'en' ? settings?.prompt_en : settings?.prompt_ru;
      
      // ✅ ИСПРАВЛЕНО: Убрано ограничение в 200 символов (теперь > 10)
      if (manualPrompt && manualPrompt.trim().length > 10) {
        SYSTEM_PROMPT = manualPrompt.trim();
      } else {
        // ✅ ИСПРАВЛЕНО: Если промпт пустой, для Radar Group используем FALLBACK (чтобы не выдумывал цены)
        if (client?.name === 'Radar Group' || client?.id === 'cli_1d0195a8') {
           SYSTEM_PROMPT = langSafe === 'en' ? FALLBACK_PROMPT_EN : FALLBACK_PROMPT_RU;
        } else {
           SYSTEM_PROMPT = buildAutoPrompt({
             clientName: client?.name || 'наша компания',
             industry: settings?.industry,
             services: settings?.services,
             lang: langSafe
           });
        }
      }
    }

    // AI-КЛЮЧ
    let AI_KEY = null;

    if (isDemo) {
      AI_KEY = FALLBACK_AI_KEY;
    } else {
      if (settings?.ai_api_key) {
        AI_KEY = settings.ai_api_key;
      } else if (settings?.use_radar_ai_key_widget === 1 && FALLBACK_AI_KEY) {
        AI_KEY = FALLBACK_AI_KEY;
      }
    }

    if (!AI_KEY) {
      return jsonResponse({
        error: langSafe === 'en'
          ? 'AI key is not configured. Contact the administrator.'
          : 'AI-ключ не настроен. Обратитесь к администратору.'
      }, 503);
    }

    // СОЗДАТЬ ДИАЛОГ (если его нет)
    let activeDialogId = dialog_id;
    if (!activeDialogId && !isDemo) {
      activeDialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);
      await env.radar_group_db.prepare(
        `INSERT INTO dialogs (id, client_id, channel, status) VALUES (?, ?, 'widget', 'active')`
      ).bind(activeDialogId, client.id).run();
    }

    // AI
    const provider = isDemo ? 'proxyapi' : (settings?.ai_provider || 'proxyapi');
    const baseUrl = isDemo ? null : (settings?.ai_base_url || null);

    const reply = await callAI({
      provider, apiKey: AI_KEY, baseUrl,
      systemPrompt: SYSTEM_PROMPT,
      messages: messages || []
    });

    // ЗАПИСЬ
    if (activeDialogId && !isDemo) {
      const lastUserMsg = messages?.[messages.length - 1];
      if (lastUserMsg?.content) {
        await env.radar_group_db.prepare(
          `INSERT INTO messages (id, dialog_id, role, content) VALUES (?, ?, 'user', ?)`
        ).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, lastUserMsg.content).run();
      }

      await env.radar_group_db.prepare(
        `INSERT INTO messages (id, dialog_id, role, content, tokens_used, cost_usd)
         VALUES (?, ?, 'assistant', ?, 0, 0)`
      ).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, reply).run();
    }

    const contactReady = /инженер|engineer|менеджер|manager/i.test(reply);

    return jsonResponse({ reply: reply.trim(), contactReady, dialog_id: activeDialogId });

  } catch (err) {
    console.error('Chat error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

async function callAI({ provider, apiKey, baseUrl, systemPrompt, messages }) {
  if (provider === 'claude') return await callClaude({ apiKey, baseUrl, systemPrompt, messages });
  if (provider === 'gemini') return await callGemini({ apiKey, baseUrl, systemPrompt, messages });
  return await callOpenAI({ provider, apiKey, baseUrl, systemPrompt, messages });
}

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
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7, 
      max_tokens: 500, // ✅ УВЕЛИЧЕНО с 200
      frequency_penalty: 0.0, // ✅ УБРАНО
      presence_penalty: 0.0   // ✅ УБРАНО
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI error');
  return data.choices[0].message.content;
}

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
      max_tokens: 500, // ✅ УВЕЛИЧЕНО с 200
      system: systemPrompt, 
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude error');
  return data.content[0].text;
}

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
      generationConfig: { 
        temperature: 0.7, 
        maxOutputTokens: 500 // ✅ УВЕЛИЧЕНО с 200
      }
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
  return data.candidates[0].content.parts[0].text;
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}