// ============================================
// Radar Group — Chat API (RU/EN)
// ProxyAPI + сбор контакта + защита от спама
// ============================================

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

const SYSTEM_PROMPT_RU = `Ты — опытный ИИ-менеджер компании Radar Group. Живой продавец-консультант. Ты НЕ скрываешь, что ты ИИ.

ГЛАВНОЕ ПРАВИЛО:
Отвечай на то, что клиент сказал сейчас. Не повторяй вопрос. Не задавай два вопроса в одном сообщении.

ФОРМАТ ОТВЕТА:
— 2–3 коротких блока.
— Между блоками — пустая строка.
— Каждый блок — 1–2 предложения.
— В каждом сообщении 1–2 смайла (🙂 😄 👍 🎯 💡 😊).
— Без markdown, без списков.

ТВОЯ РОЛЬ:
Ты ведёшь живой диалог. Ты эксперт — сам рассказываешь пользу под нишу клиента.

ЧТО УЗНАТЬ О КЛИЕНТЕ (постепенно, не списком):
— Ниша (чем занимается)
— Какие сценарии нужны
— Канал (Telegram, WhatsApp, Instagram, VK, Avito, сайт)
— Есть ли CRM
— Сколько заявок в день

ОТРАБОТКА ВОЗРАЖЕНИЙ:
— «Дорого» → «Понимаю 🙂 Разработка от 100$, точная цена зависит от задачи. Давайте разберёмся, что нужно.»
— «Подумаю» → «Конечно 🙂 Если появятся вопросы — я здесь.»
— «Позже» → «Понял, не давлю 👍 Когда будете готовы — продолжим.»

ПРО ЦЕНУ:
Разработка от 100$. Точную цифру называешь после 2–3 уточнений.

КОГДА ВСЁ СОБРАНО:
Когда знаешь минимум 3 параметра (ниша, канал, заявки) — задай финальный вопрос, упомянув инженера:
«Давайте передам вашу задачу инженеру — он свяжется с Вами и обсудит детали. Хорошо? 🙂»

ВАЖНО: не пиши просто «Хорошо?» без упоминания инженера.

ЗАПРЕЩЕНО:
— «Как Вам такая идея?», «Интересно?», «Нравится?», «Подходит?»
— «До свидания», «Всего доброго», «Удачи»
— «Какой удобный способ связи»

ТОН:
Живой, дружелюбный, на «Вы». Как опытный менеджер, а не робот.`;

const SYSTEM_PROMPT_EN = `You are an experienced AI Manager at Radar Group. A live sales consultant. You don't hide that you are AI.

MAIN RULE:
Answer what the client just said. Don't repeat questions. Don't ask two questions in one message.

RESPONSE FORMAT:
— 2–3 short blocks.
— Empty line between blocks.
— Each block — 1–2 sentences.
— 1–2 emojis per message (🙂 😄 👍 🎯 💡 😊).
— No markdown, no lists.

YOUR ROLE:
You lead a live conversation. You're an expert — you tell the client how it helps in their niche.

WHAT TO LEARN ABOUT THE CLIENT (gradually, not as a list):
— Niche (what they do)
— Which scenarios they need
— Channel (Telegram, WhatsApp, Instagram, VK, Avito, website)
— Do they have a CRM
— How many leads per day

HANDLING OBJECTIONS:
— "Expensive" → "I understand 🙂 Development starts from $100, the exact price depends on the task. Let's figure out what you need."
— "Let me think" → "Of course 🙂 If you have questions — I'm here."
— "Later" → "Got it, no pressure 👍 When you're ready — we'll continue."

ABOUT PRICE:
Development from $100. Give the exact number after 2–3 clarifications.

WHEN EVERYTHING IS COLLECTED:
When you know at least 3 parameters (niche, channel, leads) — ask the final question, mentioning the engineer:
"Let me pass your task to our engineer — he will contact you and discuss the details. Okay? 🙂"

IMPORTANT: don't write just "Okay?" without mentioning the engineer.

FORBIDDEN:
— "How do you like this idea?", "Interesting?", "Do you like it?", "Suitable?"
— "Goodbye", "All the best", "Good luck"
— "What's the most convenient way to contact you?"

TONE:
Live, friendly, polite. Like an experienced manager, not a robot.`;

export async function onRequestPost(context) {
  const BOT_TOKEN = context.env.BOT_TOKEN;
  const CHAT_ID = context.env.CHAT_ID;
  const PROXYAPI_KEY = context.env.OPENAI_API_KEY;

  try {
    const { messages, contact, history, lang } = await context.request.json();

    // ============================================
    // ЗАЩИТА ОТ СПАМА
    // ============================================
    const ip = context.request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const record = RATE_LIMIT_MAP.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }

    record.count++;
    RATE_LIMIT_MAP.set(ip, record);

    if (record.count > RATE_LIMIT_MAX) {
      return new Response(JSON.stringify({
        error: 'Слишком много сообщений. Подождите пару минут 🙂'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // ОТПРАВКА КОНТАКТА В TELEGRAM
    // ============================================
    if (contact) {
      const dialogLog = (history || [])
        .map(m => `• *${m.role === 'user' ? 'Клиент' : 'Бот'}:* ${String(m.content).slice(0, 200)}`)
        .join('\n');

      const text = `🔥 *НОВЫЙ ЛИД С ЧАТА*\n\n` +
        `📞 *Контакт:* ${contact}\n` +
        `🌐 *Язык:* ${lang === 'en' ? 'EN' : 'RU'}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}\n\n` +
        `📝 *Диалог:*\n${dialogLog.slice(0, 3000)}`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // ОБЫЧНЫЙ ЗАПРОС К AI
    // ============================================
    if (!PROXYAPI_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Выбираем промпт по языку страницы
    const SYSTEM_PROMPT = lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_RU;

    const response = await fetch('https://api.proxyapi.ru/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROXYAPI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.9,
        max_tokens: 400,
        frequency_penalty: 0.6,
        presence_penalty: 0.6
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await notifyTelegram(BOT_TOKEN, CHAT_ID, `❌ ProxyAPI ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
      throw new Error(data.error?.message || 'ProxyAPI error');
    }

    const reply = data.choices[0].message.content;
    const contactReady = reply.toLowerCase().includes('инженер') || reply.toLowerCase().includes('engineer');

    return new Response(JSON.stringify({
      reply: reply.trim(),
      contactReady: contactReady
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    await notifyTelegram(BOT_TOKEN, CHAT_ID, `🚨 Ошибка в chat.js: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function notifyTelegram(token, chatId, text) {
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  } catch (e) {
    // молча
  }
}