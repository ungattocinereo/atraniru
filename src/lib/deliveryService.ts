import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { markDelivered, updateRetryCount, type QueuedMessage } from './messageQueue';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// In-memory lock to prevent concurrent delivery of the same message
const inFlight = new Set<string>();

export function isInFlight(filename: string): boolean {
  return inFlight.has(filename);
}

export async function sendViaTelegram(
  telegramText: string,
  botToken: string,
  chatId: string,
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await sleep(Math.pow(2, attempt - 1) * 1000);
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: telegramText,
            parse_mode: 'HTML',
          }),
        }
      );

      if (response.ok) return true;

      const errorText = await response.text();
      console.error(`[Delivery] Telegram attempt ${attempt}/${maxRetries} failed: HTTP ${response.status} - ${errorText}`);
    } catch (err) {
      console.error(`[Delivery] Telegram attempt ${attempt}/${maxRetries} network error:`, err);
    }
  }

  return false;
}

// Lazy singleton SMTP transporter
let smtpTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return smtpTransporter;
}

export async function sendViaEmail(message: QueuedMessage): Promise<boolean> {
  const transporter = getSmtpTransporter();
  const user = process.env.SMTP_USER;
  const to = process.env.SMTP_TO;

  if (!transporter || !user || !to) {
    console.error('[Delivery] SMTP not configured, skipping email fallback');
    return false;
  }

  try {
    const body = [
      `Имя: ${message.name}`,
      `Email: ${message.email}`,
      '',
      `Сообщение:`,
      message.message,
      '',
      '---',
      `IP: ${message.metadata.ip}`,
      `Дата/Время: ${message.metadata.dateTime}`,
      `User Agent: ${message.metadata.userAgent}`,
      `Referer: ${message.metadata.referer}`,
      `Язык: ${message.metadata.acceptLanguage}`,
      '',
      `ID: ${message.id}`,
      `Попыток доставки: ${message.retryCount + 1}`,
    ].join('\n');

    await transporter.sendMail({
      from: `"Atrani.ru" <${user}>`,
      to,
      subject: `[Atrani.ru] Сообщение от ${message.name} (${message.email})`,
      text: body,
    });

    console.log(`[Delivery] Email sent for message ${message.id}`);
    return true;
  } catch (err) {
    console.error('[Delivery] Email send failed:', err);
    return false;
  }
}

const MAX_RETRIES = 50;

export async function attemptDelivery(message: QueuedMessage, filename: string): Promise<boolean> {
  // Prevent concurrent delivery of the same message
  if (inFlight.has(filename)) return false;
  inFlight.add(filename);

  try {
    // Give up after too many retries
    if (message.retryCount >= MAX_RETRIES) {
      console.error(`[Delivery] Message ${message.id} exceeded max retries (${MAX_RETRIES}), giving up`);
      return false;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Try Telegram first
    if (botToken && chatId) {
      const telegramOk = await sendViaTelegram(message.telegramText, botToken, chatId);
      if (telegramOk) {
        await markDelivered(filename, 'telegram');
        console.log(`[Delivery] Message ${message.id} delivered via Telegram`);
        return true;
      }
    }

    // Fallback to email
    const emailOk = await sendViaEmail(message);
    if (emailOk) {
      await markDelivered(filename, 'email');
      console.log(`[Delivery] Message ${message.id} delivered via email (fallback)`);
      return true;
    }

    // Both failed
    await updateRetryCount(filename);
    console.warn(`[Delivery] Message ${message.id} delivery failed (attempt ${message.retryCount + 1}), will retry later`);
    return false;
  } finally {
    inFlight.delete(filename);
  }
}
