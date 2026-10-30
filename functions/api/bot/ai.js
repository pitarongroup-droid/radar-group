// ============================================
// POST /api/bot/ai — прокси для AI (Telegram-бот)
// ============================================

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Bot-Secret');
    if (!secret || secret !== env.BOT_SECRET) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { client_id, messages, mode } = body;

    if (!client_id || !Array.isArray(messages)) {
      return Response.json({ ok: false, error: 'client_id and messages required' }, { status: 400 });
    }

    const data = await env.radar_group_db.prepare(
      `SELECT s.*, c.account_status, c.status AS client_status, c.name AS client_name
       FROM settings s
       JOIN clients c ON c.id = s.client_id
       WHERE s.client_id = ?`
    ).bind(client_id).first();

    if (!data) return Response.json({ ok: false, error: 'Settings not found' }, { status: 404 });

    if (data.account_status !== 'approved' || (data.bot_enabled !== undefined && data.bot_enabled !== 1)) {
      return Response.json({ ok: false, error: 'Bot disabled or account blocked' }, { status: 403 });
    }

    const apiKey = data.bot_ai_api_key || (data.use_radar_ai_key_bot === 1 ? env.OPENAI_API_KEY : null);
    if (!apiKey) return Response.json({ ok: false, error: 'No AI key' }, { status: 503 });

    const provider = data.bot_ai_provider || 'proxyapi';
    const baseUrl = data.bot_ai_base_url || null;

    const BASE_TG_RULES = `Ты — опытный ИИ-менеджер в Telegram. Твоя задача — вести диалог и собирать заявки.

🚨 ВЫСШИЙ ПРИОРИТЕТ (Соблюдай это всегда):
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать цены. Если цены нет в контексте ниже — скажи "Эту информацию уточнит менеджер".
2. ОТВЕЧАЙ СТРОГО ПО ФОРМАТУ: 2 блока, между ними пустая строка. В конце вопроса — один смайл.
3. КОГДА КЛИЕНТ ГОТОВ ОСТАВИТЬ КОНТАКТ — напиши маркер [[CONTACT_READY]] в самом конце сообщения.

📏 ПРАВИЛА ДИАЛОГА:
1. ЗАДАВАЙ ТОЛЬКО ОДИН ВОПРОС ЗА РАЗ.
2. ОТВЕЧАЙ КОРОТКО. Максимум 2-3 предложения (до 300 символов).
3. ЗАПРЕЩЕНО использовать Markdown (никаких **, ##, списков). Только чистый текст.
4. 🛑 КРИТИЧЕСКИ ВАЖНО: НИКОГДА не проси клиента написать номер телефона или @username текстом! Когда он будет готов, просто напиши [[CONTACT_READY]], и система сама покажет ему удобные кнопки.

=== ИНФОРМАЦИЯ О КОМПАНИИ ===
`;

    const RADAR_GROUP_TG_PROMPT = `Ты работаешь в компании Radar Group.
1. О КОМПАНИИ: Внедряем ИИ-менеджеров для бизнеса.
2. НАШИ УСЛУГИ И ЦЕНЫ:
   — СТАРТ — 200 BYN/мес (Виджет на сайт).
   — БИЗНЕС — 350 BYN/мес (Бот + CRM).
   — ПРЕМИУМ — 500 BYN/мес (Telegram Business).
   — РАЗРАБОТКА САЙТОВ — от 500 BYN.
3. ТОН: живой, дружелюбный, на «Вы».`;

    let systemPrompt = BASE_TG_RULES;
    const manualPrompt = data.bot_prompt_ru || data.prompt_ru;

    if (manualPrompt && manualPrompt.trim().length > 10) {
      systemPrompt += manualPrompt.trim();
    } else {
      if (data.client_name === 'Radar Group' || client_id === 'cli_1d0195a8') {
        systemPrompt += RADAR_GROUP_TG_PROMPT;
      } else {
        systemPrompt += `Ты работаешь в компании "${data.client_name || 'наша компания'}". Узнай потребности клиента и собери контакт.`;
      }
    }

    let reply;
    if (provider === 'claude') {
      reply = await callClaude({ apiKey, baseUrl, systemPrompt, messages });
    } else if (provider === 'gemini') {
      reply = await callGemini({ apiKey, baseUrl, systemPrompt, messages });
    } else {
      reply = await callOpenAI({ provider, apiKey, baseUrl, systemPrompt, messages });
    }

    if (!reply || !reply.trim()) throw new Error('Empty AI reply');
    return Response.json({ ok: true, reply: reply.trim() });

  } catch (err) {
    console.error('Bot AI error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret', 'Access-Control-Max-Age': '86400' }
  });
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