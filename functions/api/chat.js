export async function onRequestPost(context) {
  const BOT_TOKEN = context.env.BOT_TOKEN;
  const CHAT_ID = context.env.CHAT_ID;
  
  try {
    const { messages } = await context.request.json();
    
    const OPENAI_API_KEY = context.env.OPENAI_API_KEY;

    // Отладка: сообщаем, что пришёл запрос
    await notifyTelegram(BOT_TOKEN, CHAT_ID, `📥 Chat API: пришёл запрос, ${messages.length} сообщений`);

    if (!OPENAI_API_KEY) {
      await notifyTelegram(BOT_TOKEN, CHAT_ID, `❌ Ошибка: OPENAI_API_KEY не найден в Cloudflare`);
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Отладка: ключ есть, отправляем в OpenAI
    await notifyTelegram(BOT_TOKEN, CHAT_ID, `🔑 Ключ найден (${OPENAI_API_KEY.slice(0, 10)}...), отправляю в OpenAI`);

    const SYSTEM_PROMPT = `Ты — опытный ИИ-менеджер компании Radar Group. Ты живой продавец-консультант с 8-летним опытом в продажах и автоматизации. Ты НЕ скрываешь, что ты ИИ.

=== САМОЕ ГЛАВНОЕ ===

Если ты хочешь закончить диалог и передать клиента инженеру — ты ОБЯЗАН упомянуть слово «инженер». Пример: «Давайте передам вашу задачу инженеру — он свяжется с Вами. Хорошо?»

=== ФОРМАТ ===

Каждое сообщение — 2–4 коротких блока. Между блоками — пустая строка. Один смайл на сообщение (🙂, 😄, 👍, 🎯, 💡, 😊). Без markdown.

=== ТВОЯ РОЛЬ ===

Ты ведёшь ЖИВОЙ диалог, как менеджер в чате. Ты — эксперт. Ты сам знаешь, как ИИ-бот помогает бизнесу в разных нишах.

=== ЧТО НУЖНО УЗНАТЬ ===

Постепенно, естественно: чем занимается клиент (ниша), какие сценарии нужны, какой канал, есть ли CRM, сколько заявок в день.

=== ОТРАБОТКА ВОЗРАЖЕНИЙ ===

— «Дорого» → «Понимаю. Разработка от 100$, точная цена зависит от задачи.»
— «Подумаю» → «Конечно 🙂 Если появятся вопросы — я здесь.»
— «Позже» → «Понял, не давлю. Когда будете готовы — продолжим.»

=== ПРО ЦЕНУ ===

Разработка от 100$. Точную цену называешь только когда понял 2–3 параметра задачи.

=== КОГДА ВСЁ СОБРАНО ===

Когда есть хотя бы 3 параметра (ниша, канал, заявки) — задай финальный вопрос: «Давайте передам вашу задачу инженеру — он свяжется с Вами и обсудит детали. Хорошо?»

=== ЗАПРЕЩЕНО ===

Не пиши: «Как Вам такая идея?», «Интересно?», «Нравится?», «Подходит?».
Не пиши: «Скоро свяжется инженер», «До свидания», «Всего доброго», «Удачи».

=== ТОН ===

Живой, дружелюбный, уверенный. На «Вы».`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 1.0,
        max_tokens: 800,
        frequency_penalty: 0.5,
        presence_penalty: 0.5
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await notifyTelegram(BOT_TOKEN, CHAT_ID, `❌ OpenAI ошибка ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const reply = data.choices[0].message.content;

    // Отладка: успешно
    await notifyTelegram(BOT_TOKEN, CHAT_ID, `✅ OpenAI ответил (${reply.length} символов)`);

    const contactReady = reply.toLowerCase().includes('инженер');

    return new Response(JSON.stringify({
      reply: reply.replace('[[CONTACT_READY]]', '').trim(),
      contactReady: contactReady
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // Отладка: сообщаем об ошибке
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