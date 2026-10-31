// functions/api/instagram/webhook.js

export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = 'radar2026'; 

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const body = await request.json();

    if (body.object === 'instagram' || body.object === 'page') {
      for (const entry of body.entry) {
        const messagingEvents = entry.messaging;
        
        if (messagingEvents) {
          for (const event of messagingEvents) {
            if (event.message && event.message.text) {
              const senderId = event.sender.id;
              const messageText = event.message.text;

              waitUntil(processInstagramMessage(senderId, messageText, env));
            }
          }
        }
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });

  } catch (err) {
    await logToDB(env, 'error', 'Webhook POST error: ' + err.message);
    return new Response('Error', { status: 500 });
  }
}

async function processInstagramMessage(senderId, messageText, env) {
  try {
    // Твой токен
    const ACCESS_TOKEN = 'EAAVvbGMNdXIBSznY0QEYCIq0tAPxnFD8Vn72CFFwvIZAR90mu3RBxEzQaZCX8ZBATpzGo2yz0ZCEifaPZC8DgDMstt8cxQTQoyq1VW622PCAjA54RVUxfdXcRFvFTeMfKOy6kK4X56e7AEHcdpQLO7spUbhOkFVPKpZBMYFxexrTHhOZARbVX7FOocurbHqPiQrx1RPvKNzOQklBtfhyljZCUEeAvt7QLP7JH0YJ2RK3xS1lLdNvo7uyMQZDZD'; 
    
    const CLIENT_ID = 'cli_1d0195a8'; // ID клиента Radar Group

    // 1. ЛОВИМ НОМЕР ТЕЛЕФОНА ИЗ ТЕКСТА
    const phoneRegex = /(\+?\d[\d\s\-\(\)]{8,18}\d)/;
    const phoneMatch = messageText.match(phoneRegex);
    const isPhone = !!phoneMatch;

    // 2. ПОЛУЧАЕМ НАСТРОЙКИ
    const data = await env.radar_group_db.prepare(
      `SELECT s.prompt_ru, s.ai_api_key, s.use_radar_ai_key_widget, 
              s.channel_telegram_enabled, s.admin_allow_telegram, 
              s.telegram_token, s.telegram_admin_id
       FROM settings s WHERE s.client_id = ?`
    ).bind(CLIENT_ID).first();

    const apiKey = data?.ai_api_key || (data?.use_radar_ai_key_widget === 1 ? env.OPENAI_API_KEY : null);
    
    // 3. ЕСЛИ ЭТО НОМЕР ТЕЛЕФОНА -> СОХРАНЯЕМ ЛИД И УВЕДОМЛЯЕМ
    if (isPhone) {
      const cleanPhone = phoneMatch[0];
      
      // Создаем или обновляем диалог
      let dialogId = 'ig_' + senderId; // Используем ID из Instagram
      const existing = await env.radar_group_db.prepare(`SELECT id FROM dialogs WHERE id = ?`).bind(dialogId).first();
      
      if (!existing) {
        await env.radar_group_db.prepare(
          `INSERT INTO dialogs (id, client_id, channel, status) VALUES (?, ?, 'instagram', 'active')`
        ).bind(dialogId, CLIENT_ID).run();
      }
      
      // Сохраняем лид
      await env.radar_group_db.prepare(
        `UPDATE dialogs SET is_lead = 1, user_contact = ?, user_name = ?, lead_data = ? WHERE id = ?`
      ).bind(cleanPhone, 'Instagram Клиент', JSON.stringify({ contact: cleanPhone, source: 'instagram' }), dialogId).run();

      // Отправляем в Telegram менеджеру
      if (data?.channel_telegram_enabled === 1 && data?.admin_allow_telegram === 1 && data?.telegram_token && data?.telegram_admin_id) {
        const leadText = `🔥 НОВЫЙ ЛИД (Instagram)\n\n📞 Контакт: ${cleanPhone}\n💬 Сообщение: ${messageText}`;
        try {
          await fetch(`https://api.telegram.org/bot${data.telegram_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: data.telegram_admin_id, text: leadText })
          });
        } catch (e) {}
      }

      // Отвечаем клиенту в Instagram, что заявка принята
      await sendInstagramMessage(senderId, 'Отлично! Я записал ваш номер. Менеджер свяжется с вами в ближайшее время. 🙂', ACCESS_TOKEN, env);
      return;
    }

    // 4. ЕСЛИ ЭТО НЕ НОМЕР -> ОТВЕЧАЕТ ИИ
    if (!apiKey) {
      await logToDB(env, 'error', 'Не найден OpenAI ключ');
      return;
    }

    const systemPrompt = `Ты — опытный ИИ-менеджер компании Radar Group в Instagram.
ПРАВИЛА:
1. Отвечай коротко, дружелюбно.
2. Задавай только ОДИН вопрос за раз.
3. Когда клиент готов оставить заявку, вежливо попроси его написать номер телефона прямо в чат.
4. НЕ выдумывай цены.

ИНФОРМАЦИЯ:
${data?.prompt_ru || 'Продаем ИИ-менеджеров для бизнеса.'}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: messageText }],
        temperature: 0.7, max_tokens: 300
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      await logToDB(env, 'error', 'OpenAI Error: ' + JSON.stringify(aiData));
      return;
    }

    const replyText = aiData.choices?.[0]?.message?.content || 'Секунду, я передам информацию менеджеру.';
    await sendInstagramMessage(senderId, replyText, ACCESS_TOKEN, env);

  } catch (err) {
    await logToDB(env, 'error', 'Process Error: ' + err.message);
  }
}

async function sendInstagramMessage(recipientId, text, accessToken, env) {
  const url = `https://graph.facebook.com/v25.0/me/messages?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text } })
  });
  if (!res.ok) {
    await logToDB(env, 'error', 'Instagram API Error: ' + JSON.stringify(await res.json()));
  }
}

async function logToDB(env, level, message) {
  try {
    await env.radar_group_db.prepare(
      `INSERT INTO logs (id, level, message, created_at) VALUES (?, ?, ?, unixepoch())`
    ).bind('log_' + crypto.randomUUID().slice(0, 8), level, message).run();
  } catch (e) {}
}