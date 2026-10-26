// ============================================
// POST /api/bot/ai — прокси для AI (VPS-бот)
// Авторизация: X-Bot-Secret
// Body: { client_id, messages, mode }
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

    // ⚠️ ИСПРАВЛЕНО: Запрашиваем данные из settings И clients одновременно (JOIN)
    const data = await env.radar_group_db.prepare(
      `SELECT c.account_status, s.bot_enabled, s.bot_prompt_ru, s.bot_prompt_en, 
              s.bot_ai_provider, s.bot_ai_api_key, s.bot_ai_base_url, 
              s.bot_reminders_enabled, s.use_radar_ai_key_bot
       FROM settings s
       JOIN clients c ON c.id = s.client_id
       WHERE s.client_id = ?`
    ).bind(client_id).first();

    if (!data) {
      return Response.json({ ok: false, error: 'Settings not found' }, { status: 404 });
    }

    // ⚠️ ИСПРАВЛЕНО: Проверяем, что аккаунт одобрен и галочка бота включена
    if (data.account_status !== 'approved' || data.bot_enabled !== 1) {
      return Response.json({ ok: false, error: 'Bot disabled or account blocked' }, { status: 403 });
    }

    // Логика ключа (осталась твоя, она правильная)
    let apiKey = null;

    if (data.bot_ai_api_key) {
      apiKey = data.bot_ai_api_key;
    } else if (data.use_radar_ai_key_bot === 1 && env.OPENAI_API_KEY) {
      apiKey = env.OPENAI_API_KEY;
    }

    if (!apiKey) {
      return Response.json({ ok: false, error: 'No AI key' }, { status: 503 });
    }

    const provider = data.bot_ai_provider || 'proxyapi';
    const baseUrl = data.bot_ai_base_url || null;
    const systemPrompt = data.bot_prompt_ru || data.bot_prompt_en || '';

    if (mode === 'reminder' && data.bot_reminders_enabled !== 1) {
      return Response.json({ ok: false, error: 'Reminders disabled' }, { status: 403 });
    }

    let reply;

    if (provider === 'claude') {
      reply = await callClaude({ apiKey, baseUrl, systemPrompt, messages });
    } else if (provider === 'gemini') {
      reply = await callGemini({ apiKey, baseUrl, systemPrompt, messages });
    } else {
      reply = await callOpenAI({ provider, apiKey, baseUrl, systemPrompt, messages });
    }

    return Response.json({ ok: true, reply: reply.trim() });

  } catch (err) {
    console.error('Bot AI error:', err);
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
      temperature: 0.7, max_tokens: 150, // Твой лимит 150
      frequency_penalty: 0.6, presence_penalty: 0.6
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
      max_tokens: 150, system: systemPrompt, messages // Твой лимит 150
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
      generationConfig: { temperature: 0.7, maxOutputTokens: 150 } // Твой лимит 150
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
  return data.candidates[0].content.parts[0].text;
}