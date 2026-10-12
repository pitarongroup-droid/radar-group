// ============================================
// Radar Group — Chat API
// ProxyAPI + сбор контакта + защита от спама
// ============================================

const RATE_LIMIT_MAP = new Map(); // простая память в рамках одного Worker
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 минут
const RATE_LIMIT_MAX = 10; // не более 10 сообщений за 5 минут

export async function onRequestPost(context) {
  const BOT_TOKEN = context.env.BOT_TOKEN;
  const CHAT_ID = context.env.CHAT_ID;
  const PROXYAPI_KEY = context.env.OPENAI_API_KEY;

  try {
    const { messages, contact, history } = await context.request.json();

    // ============================================
    // ЗАЩИТА ОТ СПАМА (rate limiting по IP)
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

    const SYSTEM_PROMPT = `Ты — опытный ИИ-менеджер компании Radar Group. Живой продавец-консультант. Ты НЕ скрываешь, что ты ИИ.

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
    const contactReady = reply.toLowerCase().includes('инженер');

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