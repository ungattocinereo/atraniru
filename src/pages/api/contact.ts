import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, email, message } = data;

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Все поля обязательны для заполнения' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get technical data
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || 'Direct';
    const acceptLanguage = request.headers.get('accept-language') || 'Unknown';

    // Get IP address (with various fallbacks for different hosting environments)
    let ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'Unknown';

    // Get current date/time
    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Format Telegram message with emojis
    const telegramMessage = `🗼 <b>Сообщение с сайта Atrani.ru</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
📧 <b>Email:</b> ${escapeHtml(email)}

💬 <b>Сообщение:</b>
${escapeHtml(message)}

━━━━━━━━━━━━━━━━━━━━
📊 <b>Технические данные:</b>

🌐 <b>IP-адрес:</b> ${ipAddress}
🕐 <b>Дата/Время:</b> ${dateTime}
🖥 <b>User Agent:</b> ${escapeHtml(userAgent)}
🔗 <b>Referer:</b> ${escapeHtml(referer)}
🌍 <b>Язык:</b> ${acceptLanguage}`;

    // Send to Telegram
    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Telegram не настроен' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramMessage,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!telegramResponse.ok) {
      const error = await telegramResponse.text();
      console.error('Telegram API error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Ошибка отправки в Telegram' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Сообщение успешно отправлено' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Произошла ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Helper function to escape HTML characters
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
