import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { enqueue, type QueuedMessage } from '../../lib/messageQueue';
import { attemptDelivery } from '../../lib/deliveryService';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, email, message } = data;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Все поля обязательны для заполнения' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate field lengths
    if (name.length > 200 || email.length > 200 || message.length > 10000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Превышена максимальная длина полей' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Некорректный формат email' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Collect metadata
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || 'Direct';
    const acceptLanguage = request.headers.get('accept-language') || 'Unknown';
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'Unknown';

    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const telegramText = formatTelegramMessage(name, email, message, {
      ip: ipAddress, userAgent, referer, acceptLanguage, dateTime,
    });

    const queuedMessage: QueuedMessage = {
      id: crypto.randomBytes(8).toString('hex'),
      createdAt: now.toISOString(),
      name,
      email,
      message,
      telegramText,
      metadata: { ip: ipAddress, userAgent, referer, acceptLanguage, dateTime },
      retryCount: 0,
      lastAttempt: null,
      deliveredVia: null,
    };

    // CRITICAL: persist to disk FIRST — this is the reliability guarantee
    const filename = await enqueue(queuedMessage);

    // Attempt delivery in the background (non-blocking)
    attemptDelivery(queuedMessage, filename).catch((err) => {
      console.error('[Contact] Background delivery error:', err);
    });

    // Respond immediately — message is safely on disk
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

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatTelegramMessage(
  name: string,
  email: string,
  message: string,
  meta: { ip: string; userAgent: string; referer: string; acceptLanguage: string; dateTime: string }
): string {
  return `🗼 <b>Сообщение с сайта Atrani.ru</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
📧 <b>Email:</b> ${escapeHtml(email)}

💬 <b>Сообщение:</b>
${escapeHtml(message)}

━━━━━━━━━━━━━━━━━━━━
📊 <b>Технические данные:</b>

🌐 <b>IP-адрес:</b> ${meta.ip}
🕐 <b>Дата/Время:</b> ${meta.dateTime}
🖥 <b>User Agent:</b> ${escapeHtml(meta.userAgent)}
🔗 <b>Referer:</b> ${escapeHtml(meta.referer)}
🌍 <b>Язык:</b> ${meta.acceptLanguage}`;
}
