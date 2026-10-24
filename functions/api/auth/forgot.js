export async function onRequestPost({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ ok: false, error: { ru: 'Укажите email' } }, { status: 400 });

    // Ищем пользователя и его компанию
    const user = await env.radar_group_db.prepare(
      `SELECT u.id as user_id, u.email, c.name as client_name, c.company
       FROM users u
       JOIN clients c ON u.client_id = c.id
       WHERE u.email = ?`
    ).bind(email.toLowerCase()).first();

    // Из соображений безопасности не говорим, существует ли email
    if (!user) return Response.json({ ok: true });

    // Генерируем токен на 15 минут
    const token = crypto.randomUUID();
    const expires = Date.now() + 15 * 60 * 1000;

    await env.radar_group_db.prepare(
      `UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`
    ).bind(token, expires, user.user_id).run();

    const resetLink = `https://radar-group.org/app/reset-password.html?token=${token}`;
    
    // Формируем сообщение для тебя (Админа)
    const adminMessage = 
      `🔐 <b>ЗАПРОС НА СБРОС ПАРОЛЯ</b>\n\n` +
      `👤 <b>Клиент:</b> ${user.client_name || 'Не указано'}\n` +
      `🏢 <b>Компания:</b> ${user.company || 'Не указано'}\n` +
      `📧 <b>Email:</b> ${user.email}\n\n` +
      `Скопируйте и отправьте клиенту эту ссылку (действует 15 минут):\n` +
      `<code>${resetLink}</code>`;

    // Отправляем тебе в Telegram (используем главный бот Radar Group)
    if (env.BOT_TOKEN && env.CHAT_ID) {
      try {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: env.CHAT_ID, 
            text: adminMessage,
            parse_mode: 'HTML' 
          })
        });
      } catch (e) {
        console.error('Admin TG error:', e);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: { ru: err.message } }, { status: 500 });
  }
}