import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quoteSource = readFileSync(new URL('../src/components/Quote.astro', import.meta.url), 'utf8');
const webhookSource = readFileSync(new URL('../webhook.mjs', import.meta.url), 'utf8');

test('about section replaces the contact CTA with a newsletter signup panel', () => {
  assert.doesNotMatch(quoteSource, /href="#contact" class="btn btn-primary">Познакомиться/);
  assert.match(quoteSource, /data-newsletter-form/);
  assert.match(quoteSource, /type="email"/);
  assert.match(quoteSource, /Подписаться/);
  assert.match(quoteSource, /data-newsletter-success/);
});

test('newsletter form posts to the public subscription hook and swaps to a thank-you state', () => {
  assert.match(quoteSource, /\/hooks\/subscribe-atrani-newsletter/);
  assert.match(quoteSource, /fetch\(newsletterForm\.action/);
  assert.match(quoteSource, /is-subscribed/);
  assert.match(quoteSource, /Спасибо что подписались на нашу рассылку/);
  assert.match(quoteSource, /редкие но яркие весточки прямо из Атрани/);
});

test('webhook exposes a hardened Ghost newsletter subscription endpoint', () => {
  assert.match(webhookSource, /GHOST_ADMIN_API_KEY/);
  assert.match(webhookSource, /POST \/hooks\/subscribe-atrani-newsletter/);
  assert.match(webhookSource, /handleNewsletterSignup/);
  assert.match(webhookSource, /ghost\/api\/admin\/members\//);
  assert.match(webhookSource, /GHOST_NEWSLETTER_ID/);
});
