export async function onRequestPost({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ ok: false, error: { ru: 'Укажите email' } }, { status: 400 });

    // Ищем пользователя в таблице users
    const user = await env.radar_group_db.prepare(
      `SELECT id, email FROM users WHERE email = ?`
    ).bind(email.toLowerCase()).first();

    // Не говорим, существует ли email (защита от перебора)
    if (!user) return Response.json({ ok: true });

    // Генерируем токен на 15 минут
    const token = crypto.randomUUID();
    const expires = Date.now() + 15 * 60 * 1000;

    await env.radar_group_db.prepare(
      `UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`
    ).bind(token, expires, user.id).run();

    const resetLink = `https://radar-group.org/app/reset-password.html?token=${token}`;
    const message = `🔐 Восстановление пароля в Radar Group\n\nДля смены пароля перейдите по ссылке (действует 15 минут):\n${resetLink}`;

    // Отправляем в Telegram (используем главный бот Radar Group, чтобы не зависеть от настроек клиента)
    const botToken = env.BOT_TOKEN;
    const chatId = env.CHAT_ID;

    if (botToken && chatId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      }).catch(e => console.error('TG error:', e));
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}