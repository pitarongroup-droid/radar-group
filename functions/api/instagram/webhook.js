// functions/api/instagram/webhook.js

export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // ⚠️ Токен должен совпадать с тем, что вы вписали в Meta (Verify Token)
  const VERIFY_TOKEN = 'radar2026'; 

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const body = await request.json();

    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        const messagingEvents = entry.messaging;
        
        if (messagingEvents) {
          for (const event of messagingEvents) {
            if (event.message && event.message.text) {
              const senderId = event.sender.id;
              const messageText = event.message.text;

              // Обработку ИИ отправляем в waitUntil, чтобы Meta получила 200 OK за 2 секунды
              waitUntil(processInstagramMessage(senderId, messageText, env));
            }
          }
        }
      }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}

// ============================================
// ЛОГИКА ОБРАБОТКИ И ОТПРАВКИ
// ============================================
async function processInstagramMessage(senderId, messageText, env) {
  try {
    // 👇👇👇 ВОТ ЗДЕСЬ НУЖНО ВСТАВИТЬ ТОКЕН 👇👇👇
    const ACCESS_TOKEN = 'EAAVvbGMNdXIBSw4XbtRtf9ZCfEJnO9GtC43uDXPJlEPWq3sWkYOdBsGfPhFzYaZALQsJBs4AOIkVPjKNdPZCZAXTqH1p8MkJOq77IqQ57e7ctvcCmH0M5gxqKZARecZCZALa2Bptf5wd9bHsYGkmN0KhhazatlZAQ9NNbU9mMsg78nbKvQwZBqiIU0eq0FHBz6ePHLtVIClRM8eIY4kAL9ZB7wryi0EbYEMHLaQ9xHSjsDjw2JDwZCoD2pi2QZDZD'; 
    // 👆👆👆 ВСТАВЬ СЮДА СТРОКУ, НАЧИНАЮЩУЮСЯ С IGAA... 👆👆👆

    const CLIENT_ID = 'cli_1d0195a8'; // ID клиента Radar Group в вашей БД

    // 2. ПОЛУЧАЕМ НАСТРОЙКИ ИЗ БАЗЫ D1
    const data = await env.radar_group_db.prepare(
      `SELECT s.prompt_ru, s.ai_api_key, s.use_radar_ai_key_widget 
       FROM settings s WHERE s.client_id = ?`
    ).bind(CLIENT_ID).first();

    const apiKey = data?.ai_api_key || (data?.use_radar_ai_key_widget === 1 ? env.OPENAI_API_KEY : null);
    if (!apiKey) {
      await sendInstagramMessage(senderId, 'Извините, произошла ошибка настройки ИИ.', ACCESS_TOKEN);
      return;
    }

    // 3. СОБИРАЕМ ПРОМПТ
    const systemPrompt = `Ты — опытный ИИ-менеджер компании Radar Group в Instagram.
Мы продаем ИИ-менеджеров для бизнеса:
— СТАРТ (200 BYN/мес)
— БИЗНЕС (350 BYN/мес)
— ПРЕМИУМ (500 BYN/мес)
— РАЗРАБОТКА САЙТОВ (от 500 BYN)

ПРАВИЛА ОБЩЕНИЯ В INSTAGRAM:
1. Отвечай коротко, дружелюбно, как в личных сообщениях.
2. Задавай только ОДИН вопрос за раз.
3. Когда клиент готов оставить заявку, вежливо попроси его написать номер телефона прямо в чат (например: "Отлично! Напишите ваш номер телефона, и менеджер свяжется с вами").
4. НЕ выдумывай цены и контакты.

=== ИНФОРМАЦИЯ О КОМПАНИИ ===
${data?.prompt_ru || 'Продаем ИИ-менеджеров.'}`;

    // 4. ЗАПРОС К ИИ
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
    const replyText = aiData.choices?.[0]?.message?.content || 'Секунду, я передам информацию менеджеру.';

    // 5. ОТПРАВЛЯЕМ ОТВЕТ В INSTAGRAM
    await sendInstagramMessage(senderId, replyText, ACCESS_TOKEN);

  } catch (err) {
    console.error('Process error:', err);
  }
}

async function sendInstagramMessage(recipientId, text, accessToken) {
  const url = `https://graph.instagram.com/v19.0/me/messages?access_token=${accessToken}`;

  const payload = {
    recipient: { id: recipientId },
    message: { text: text }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json();
    console.error('Ошибка отправки в IG:', errData);
  }
}