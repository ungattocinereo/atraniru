import { defineMiddleware } from 'astro:middleware';
import { startWorker } from './lib/backgroundWorker';

let initialized = false;

export const onRequest = defineMiddleware(async (_context, next) => {
  if (!initialized) {
    initialized = true;
    startWorker().catch((err) => {
      console.error('[Middleware] Failed to start worker:', err);
    });
  }
  return next();
});
