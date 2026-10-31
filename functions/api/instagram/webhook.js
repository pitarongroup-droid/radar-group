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

    // Instagram может присылать object = 'instagram' или 'page'
    if (body.object === 'instagram' || body.object === 'page') {
      for (const entry of body.entry) {
        const messagingEvents = entry.messaging;
        
        if (messagingEvents) {
          for (const event of messagingEvents) {
            if (event.message && event.message.text) {
              const senderId = event.sender.id;
              const messageText = event.message.text;

              console.log(`💬 Сообщение от ${senderId}: ${messageText}`);

              // Обработку ИИ отправляем в waitUntil
              waitUntil(processInstagramMessage(senderId, messageText, env));
            }
          }
        }
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });

  } catch (err) {
    console.error('❌ Ошибка в onRequestPost:', err);
    return new Response('Error', { status: 500 });
  }
}

// ============================================
// ЛОГИКА ОБРАБОТКИ И ОТПРАВКИ
// ============================================
async function processInstagramMessage(senderId, messageText, env) {
  try {
    // 👇👇👇 ВСТАВЬ СЮДА ТОКЕН (IGAA...) 👇👇👇
    const ACCESS_TOKEN = 'EAAVvbGMNdXIBSznY0QEYCIq0tAPxnFD8Vn72CFFwvIZAR90mu3RBxEzQaZCX8ZBATpzGo2yz0ZCEifaPZC8DgDMstt8cxQTQoyq1VW622PCAjA54RVUxfdXcRFvFTeMfKOy6kK4X56e7AEHcdpQLO7spUbhOkFVPKpZBMYFxexrTHhOZARbVX7FOocurbHqPiQrx1RPvKNzOQklBtfhyljZCUEeAvt7QLP7JH0YJ2RK3xS1lLdNvo7uyMQZDZD'; 
    
    const CLIENT_ID = 'cli_1d0195a8'; // ID клиента Radar Group

    console.log('1️⃣ Начинаем обработку. Проверяем настройки в БД...');
    const data = await env.radar_group_db.prepare(
      `SELECT s.prompt_ru, s.ai_api_key, s.use_radar_ai_key_widget 
       FROM settings s WHERE s.client_id = ?`
    ).bind(CLIENT_ID).first();

    const apiKey = data?.ai_api_key || (data?.use_radar_ai_key_widget === 1 ? env.OPENAI_API_KEY : null);
    if (!apiKey) {
      console.error('❌ Ошибка: не найден API-ключ OpenAI в базе!');
      await sendInstagramMessage(senderId, 'Извините, ошибка настройки ИИ.', ACCESS_TOKEN);
      return;
    }

    console.log('2️⃣ Ключ найден. Отправляем запрос в OpenAI...');
    
    // Полный промпт для Instagram (адаптированный под переписку)
    const systemPrompt = `Ты — опытный ИИ-менеджер компании Radar Group в Instagram.
Мы продаем ИИ-менеджеров для бизнеса:
— СТАРТ (200 BYN/мес): виджет на сайт
— БИЗНЕС (350 BYN/мес): бот + CRM
— ПРЕМИУМ (500 BYN/мес): Telegram Business + личный менеджер
— РАЗРАБОТКА САЙТОВ (от 500 BYN)

ПРАВИЛА ОБЩЕНИЯ:
1. Отвечай коротко, дружелюбно, как в личных сообщениях.
2. Задавай только ОДИН вопрос за раз.
3. Когда клиент готов оставить заявку, вежливо попроси его написать номер телефона прямо в чат (например: "Отлично! Напишите ваш номер телефона, и менеджер свяжется с вами").
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
      console.error('❌ Ошибка OpenAI:', JSON.stringify(aiData));
      return;
    }

    const replyText = aiData.choices?.[0]?.message?.content || 'Секунду, я передам информацию менеджеру.';
    console.log('3️⃣ Ответ от ИИ получен:', replyText);

    console.log('4️⃣ Отправляем ответ в Instagram...');
    await sendInstagramMessage(senderId, replyText, ACCESS_TOKEN);

  } catch (err) {
    console.error('❌ Ошибка в процессе обработки:', err);
  }
}

async function sendInstagramMessage(recipientId, text, accessToken) {
  // ✅ ОБНОВЛЕНО до v25.0
  const url = `https://graph.instagram.com/v25.0/me/messages?access_token=${accessToken}`;

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
    console.error('❌ Ошибка отправки в Instagram:', JSON.stringify(resData));
  } else {
    console.log('✅ Сообщение успешно отправлено в Instagram!');
  }
}