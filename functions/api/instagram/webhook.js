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
    console.log('📩 Получен запрос от Instagram:', JSON.stringify(body));

    if (body.object === 'instagram' || body.object === 'page') {
      for (const entry of body.entry) {
        const messagingEvents = entry.messaging;
        
        if (messagingEvents) {
          for (const event of messagingEvents) {
            if (event.message && event.message.text) {
              const senderId = event.sender.id;
              const messageText = event.message.text;

              console.log(`💬 Сообщение от ${senderId}: ${messageText}`);
              waitUntil(processInstagramMessage(senderId, messageText, env));
            }
          }
        }
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });

  } catch (err) {
    console.error('❌ Ошибка в onRequestPost:', err);
    await logToDB(env, 'error', 'Webhook POST error: ' + err.message);
    return new Response('Error', { status: 500 });
  }
}

// ============================================
// ЛОГИКА ОБРАБОТКИ И ОТПРАВКИ
// ============================================
async function processInstagramMessage(senderId, messageText, env) {
  try {
    // Твой токен (начинается с EAA)
    const ACCESS_TOKEN = 'EAAVvbGMNdXIBSznY0QEYCIq0tAPxnFD8Vn72CFFwvIZAR90mu3RBxEzQaZCX8ZBATpzGo2yz0ZCEifaPZC8DgDMstt8cxQTQoyq1VW622PCAjA54RVUxfdXcRFvFTeMfKOy6kK4X56e7AEHcdpQLO7spUbhOkFVPKpZBMYFxexrTHhOZARbVX7FOocurbHqPiQrx1RPvKNzOQklBtfhyljZCUEeAvt7QLP7JH0YJ2RK3xS1lLdNvo7uyMQZDZD'; 
    
    const CLIENT_ID = 'cli_1d0195a8'; // ID клиента Radar Group

    const data = await env.radar_group_db.prepare(
      `SELECT s.prompt_ru, s.ai_api_key, s.use_radar_ai_key_widget 
       FROM settings s WHERE s.client_id = ?`
    ).bind(CLIENT_ID).first();

    const apiKey = data?.ai_api_key || (data?.use_radar_ai_key_widget === 1 ? env.OPENAI_API_KEY : null);
    if (!apiKey) {
      await logToDB(env, 'error', 'Не найден OpenAI ключ для клиента ' + CLIENT_ID);
      return;
    }

    const systemPrompt = `Ты — опытный ИИ-менеджер компании Radar Group в Instagram.
Мы продаем ИИ-менеджеров для бизнеса:
— СТАРТ (200 BYN/мес): виджет на сайт
— БИЗНЕС (350 BYN/мес): бот + CRM
— ПРЕМИУМ (500 BYN/мес): Telegram Business + личный менеджер
— РАЗРАБОТКА САЙТОВ (от 500 BYN)

ПРАВИЛА ОБЩЕНИЯ:
1. Отвечай коротко, дружелюбно, как в личных сообщениях.
2. Задавай только ОДИН вопрос за раз.
3. Когда клиент готов оставить заявку, вежливо попроси его написать номер телефона прямо в чат.
4. НЕ выдумывай цены и контакты.

=== ИНФОРМАЦИЯ О КОМПАНИИ ===
${data?.prompt_ru || 'Продаем ИИ-менеджеров для бизнеса.'}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageText }
        ],
        temperature: 0.7,
        max_tokens: 300
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
  // ✅ КРИТИЧЕСКИ ВАЖНО: Используем graph.facebook.com для токенов EAA
  const url = `https://graph.facebook.com/v25.0/me/messages?access_token=${accessToken}`;

  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resData = await res.json();
  
  if (!res.ok) {
    // Если ошибка — пишем в базу
    await logToDB(env, 'error', 'Instagram API Error: ' + JSON.stringify(resData));
  } else {
    await logToDB(env, 'info', 'Успешный ответ в Instagram для ' + recipientId);
  }
}

// Функция для записи логов в базу данных D1
async function logToDB(env, level, message) {
  try {
    await env.radar_group_db.prepare(
      `INSERT INTO logs (id, level, message, created_at) VALUES (?, ?, ?, unixepoch())`
    ).bind('log_' + crypto.randomUUID().slice(0, 8), level, message).run();
  } catch (e) {
    console.error('DB Log error:', e);
  }
}