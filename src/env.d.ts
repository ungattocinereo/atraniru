/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GHOST_URL: string;
  readonly CONTENT_API_KEY: string;
  readonly TELEGRAM_BOT_TOKEN: string;
  readonly TELEGRAM_CHAT_ID: string;
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: string;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly SMTP_TO: string;
  readonly MESSAGE_QUEUE_DIR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
