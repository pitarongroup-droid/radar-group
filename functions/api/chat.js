// ============================================
// /api/chat — универсальный чат с AI (Виджет)
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
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  
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

// ============================================
// БАЗОВЫЙ КАРКАС (Защита от галлюцинаций)
// ============================================
const BASE_SYSTEM_RULES = `Ты — опытный ИИ-менеджер. Твоя задача — вести диалог и собирать заявки.

🚨 ВЫСШИЙ ПРИОРИТЕТ (Соблюдай это всегда, даже если текст ниже говорит иначе):
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать цены. Если цены нет в контексте ниже — скажи "Эту информацию уточнит менеджер".
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать, угадывать или придумывать контакты (номера телефонов, @username). 
3. Если клиент говорит, что уже оставил номер, но в истории чата его НЕТ — ответь строго: "Я не вижу ваш номер в нашем чате. Пожалуйста, оставьте его в форме ниже." И ОБЯЗАТЕЛЬНО добавь маркер [[CONTACT_READY]] в конце!
4. ОТВЕЧАЙ СТРОГО ПО ФОРМАТУ: 2 блока, между ними пустая строка.
5. 🛑 КРИТИЧЕСКИ ВАЖНО: НИКОГДА не проси клиента написать номер телефона текстом! Если клиент готов оставить контакт, напиши "Давайте я передам вашу заявку менеджеру" и добавь в конце маркер [[CONTACT_READY]].

📏 ПРАВИЛА ДИАЛОГА:
1. ЗАДАВАЙ ТОЛЬКО ОДИН ВОПРОС ЗА РАЗ.
2. ОТВЕЧАЙ КОРОТКО. Максимум 2-3 предложения (до 300 символов).
3. ЗАПРЕЩЕНО использовать Markdown (никаких **, ##, списков). Только чистый текст.
4. Если клиент назвал имя — используй его. Если нет — общайся на «Вы».

=== ИНФОРМАЦИЯ О КОМПАНИИ ===
`;

const RADAR_GROUP_PROMPT = `Ты работаешь в компании Radar Group. Живой продавец-консультант.
1. О КОМПАНИИ: Radar Group. Внедряем ИИ-менеджеров для бизнеса.
2. НАШИ УСЛУГИ И ЦЕНЫ:
   — СТАРТ — 200 BYN/мес: Виджет на сайт, обучение ИИ, передача заявок в Telegram.
   — БИЗНЕС — 350 BYN/мес: Всё из «Старт» + Telegram-бот, CRM/Sheets, 4 стадии дожима.
   — ПРЕМИУМ — 500 BYN/мес: Всё из «Бизнес» + Telegram Business, прямая интеграция с CRM, личный менеджер.
   — РАЗРАБОТКА САЙТОВ: от 500 BYN под ключ.
3. ТОН: живой, дружелюбный, на «Вы». При возражении «дорого» объясняй окупаемость.
4. Если клиент спрашивает "как ты ему сообщишь", "как он узнает" или "как со мной свяжутся", отвечай: "Я передам ему все детали нашего диалога. Но чтобы он точно смог с вами связаться, оставьте свой номер в форме ниже." И обязательно добавь [[CONTACT_READY]].
`;

function buildEmptyClientPrompt(clientName) {
  return `Ты работаешь в компании "${clientName}". 
Информация о ваших услугах и ценах пока не добавлена в базу.
Твоя задача: узнать, чем занимается клиент, что ему нужно, и предложить передать заявку менеджеру для детального расчета.
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

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const record = RATE_LIMIT_MAP.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + RATE_LIMIT_WINDOW_MS; }
    record.count++;
    RATE_LIMIT_MAP.set(ip, record);
    if (record.count > RATE_LIMIT_MAX) {
      return jsonResponse({ error: langSafe === 'en' ? 'Too many messages.' : 'Слишком много сообщений. Подождите пару минут 🙂' }, 429);
    }

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

    // ОБРАБОТКА ЛИДА
    if (contact) {
      let activeDialogId = dialog_id;
      if (!activeDialogId && !isDemo) {
        activeDialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);
        await env.radar_group_db.prepare(
          `INSERT INTO dialogs (id, client_id, channel, status) VALUES (?, ?, 'widget', 'active')`
        ).bind(activeDialogId, client.id).run();
      }

      const dialogLog = (history || []).map(m => `• ${m.role === 'user' ? 'Клиент' : 'Бот'}: ${String(m.content).slice(0, 200)}`).join('\n');
      const cleanPhone = extractCleanPhone(contact);
      const cleanName = extractNameFromText(contact, history) || "Клиент";
      const finalContact = cleanPhone || contact;

      if (activeDialogId && !isDemo) {
        await env.radar_group_db.prepare(
          `UPDATE dialogs SET is_lead = 1, user_contact = ?, user_name = ?, lead_data = ? WHERE id = ?`
        ).bind(finalContact, cleanName, JSON.stringify({ contact: finalContact, lang: langSafe, timestamp: new Date().toISOString() }), activeDialogId).run();

        await env.radar_group_db.prepare(
          `INSERT INTO events (id, client_id, event_name, dialog_id, language, metadata) VALUES (?, ?, 'lead.created', ?, ?, ?)`
        ).bind('evt_' + crypto.randomUUID().slice(0, 8), client.id, activeDialogId, langSafe, JSON.stringify({ contact: finalContact })).run();
      }

      const sourceName = client?.name || 'Radar Group (демо)';
      const leadText = `🔥 НОВЫЙ ЛИД\n\n🌐 Источник: Виджет на сайте "${sourceName}"\n📞 Контакт: ${finalContact}\n👤 Имя: ${cleanName}\n🕐 ${new Date().toLocaleString('ru-RU')}\n\n📝 Диалог:\n${dialogLog.slice(0, 3000)}`;

      let sent = false;
      const canTelegram = settings?.channel_telegram_enabled && settings?.admin_allow_telegram;
      if (canTelegram && settings?.telegram_token && settings?.telegram_admin_id) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${settings.telegram_token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: settings.telegram_admin_id, text: leadText })
          });
          if ((await tgRes.json()).ok) sent = true;
        } catch (e) { console.error('TG error:', e); }
      }

      const canSheets = settings?.channel_sheets_enabled && settings?.admin_allow_sheets;
      if (canSheets && settings?.sheets_url) {
        try {
          await fetch(settings.sheets_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cleanName, phone: finalContact, message: history?.slice(-1)[0]?.content || '', client: sourceName, date: new Date().toISOString() })
          });
          sent = true;
        } catch (e) { console.error('Sheets error:', e); }
      }

      if (!sent && BOT_TOKEN && CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: leadText })
        }).catch(() => {});
      }

      return jsonResponse({ ok: true, dialog_id: activeDialogId });
    }

    // СБОРКА ПРОМПТА
    let SYSTEM_PROMPT = BASE_SYSTEM_RULES;
    const manualPrompt = langSafe === 'en' ? settings?.prompt_en : settings?.prompt_ru;

    if (isDemo) {
      SYSTEM_PROMPT += RADAR_GROUP_PROMPT;
    } else if (manualPrompt && manualPrompt.trim().length > 10) {
      SYSTEM_PROMPT += manualPrompt.trim();
    } else {
      if (client?.name === 'Radar Group' || client?.id === 'cli_1d0195a8') {
        SYSTEM_PROMPT += RADAR_GROUP_PROMPT;
      } else {
        SYSTEM_PROMPT += buildEmptyClientPrompt(client?.name || 'наша компания');
      }
    }

    let AI_KEY = isDemo ? FALLBACK_AI_KEY : (settings?.ai_api_key || (settings?.use_radar_ai_key_widget === 1 ? FALLBACK_AI_KEY : null));
    if (!AI_KEY) return jsonResponse({ error: 'AI-ключ не настроен.' }, 503);

    let activeDialogId = dialog_id;
    if (!activeDialogId && !isDemo) {
      activeDialogId = 'dlg_' + crypto.randomUUID().slice(0, 8);
      await env.radar_group_db.prepare(`INSERT INTO dialogs (id, client_id, channel, status) VALUES (?, ?, 'widget', 'active')`).bind(activeDialogId, client.id).run();
    }

    const provider = isDemo ? 'proxyapi' : (settings?.ai_provider || 'proxyapi');
    const baseUrl = isDemo ? null : (settings?.ai_base_url || null);

    let reply = await callAI({ provider, apiKey: AI_KEY, baseUrl, systemPrompt: SYSTEM_PROMPT, messages: messages || [] });

    const isContactReady = reply.includes('[[CONTACT_READY]]');
    reply = reply.replace(/\[\[CONTACT_READY\]\]/g, '').trim();

    if (activeDialogId && !isDemo) {
      const lastUserMsg = messages?.[messages.length - 1];
      if (lastUserMsg?.content) {
        await env.radar_group_db.prepare(`INSERT INTO messages (id, dialog_id, role, content) VALUES (?, ?, 'user', ?)`).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, lastUserMsg.content).run();
      }
      await env.radar_group_db.prepare(`INSERT INTO messages (id, dialog_id, role, content, tokens_used, cost_usd) VALUES (?, ?, 'assistant', ?, 0, 0)`).bind('msg_' + crypto.randomUUID().slice(0, 8), activeDialogId, reply).run();
    }

    return jsonResponse({ reply: reply.trim(), contactReady: isContactReady, dialog_id: activeDialogId });

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
  let url = baseUrl || (provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.proxyapi.ru/v1/chat/completions');
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7, max_tokens: 500, frequency_penalty: 0.0, presence_penalty: 0.0
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'AI error');
  return data.choices[0].message.content;
}

async function callClaude({ apiKey, baseUrl, systemPrompt, messages }) {
  const url = baseUrl || 'https://api.anthropic.com/v1/messages';
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 500, system: systemPrompt, messages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude error');
  return data.content[0].text;
}

async function callGemini({ apiKey, baseUrl, systemPrompt, messages }) {
  const url = baseUrl ? `${baseUrl}?key=${apiKey}` : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 500 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
  return data.candidates[0].content.parts[0].text;
}