export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // Отдаём sitemap.xml с правильным Content-Type
  if (url.pathname === '/sitemap.xml') {
    const asset = await context.env.ASSETS.fetch(new Request(new URL('/sitemap.xml', url)));
    return new Response(asset.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // Отдаём robots.txt с правильным Content-Type
  if (url.pathname === '/robots.txt') {
    const asset = await context.env.ASSETS.fetch(new Request(new URL('/robots.txt', url)));
    return new Response(asset.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();

    const BOT_TOKEN = context.env.BOT_TOKEN;
    const CHAT_ID = context.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ ok: false, error: 'Config missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, contact, niche, features, comment, lang } = data;

    if (!name || !contact || !niche) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const escapeHtml = (str) =>
      String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const featuresText = features
      ? features.map(f => `   • ${f}`).join('\n')
      : '   • —';

    const LANG = lang === 'en' ? 'en' : 'ru';

    const text =
      `🔥 <b>${LANG === 'en' ? 'New request from website' : 'Новая заявка с сайта'}</b>\n\n` +
      `👤 <b>${LANG === 'en' ? 'Name' : 'Имя'}:</b> ${escapeHtml(name)}\n` +
      `📞 <b>${LANG === 'en' ? 'Contact' : 'Контакт'}:</b> ${escapeHtml(contact)}\n` +
      `🏢 <b>${LANG === 'en' ? 'Niche' : 'Ниша'}:</b> ${escapeHtml(niche)}\n\n` +
      `🎯 <b>${LANG === 'en' ? 'Needs' : 'Что нужно'}:</b>\n${featuresText}\n\n` +
      `💬 <b>${LANG === 'en' ? 'Comment' : 'Комментарий'}:</b>\n${comment ? escapeHtml(comment) : '—'}\n\n` +
      `🌐 <b>${LANG === 'en' ? 'Language' : 'Язык'}:</b> ${LANG.toUpperCase()}\n` +
      `🕐 ${new Date().toLocaleString(LANG === 'en' ? 'en-GB' : 'ru-RU')}`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const tgData = await tgResponse.json();

    return new Response(JSON.stringify({ ok: tgData.ok }), {
      status: tgData.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}