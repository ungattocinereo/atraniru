import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const bannerSource = readFileSync(
  new URL('../src/components/TelegramCoastBanner.astro', import.meta.url),
  'utf8',
);

test('homepage places the Telegram coast news banner before section 03', () => {
  assert.match(indexSource, /import TelegramCoastBanner from '\.\.\/components\/TelegramCoastBanner\.astro'/);
  assert.match(indexSource, /<Experiences \/>\s*<TelegramCoastBanner \/>\s*<AboutCoast \/>/);
});

test('Telegram coast banner links to the news channel and uses the supplied image', () => {
  assert.match(bannerSource, /https:\/\/t\.me\/amalfinovosti/);
  assert.match(bannerSource, /\/images\/index\/amalfi-telegram-news\.webp/);
  assert.match(bannerSource, /Новости побережья/);
  assert.match(bannerSource, /Подписаться в Telegram/);
});

test('Telegram coast banner includes responsive desktop and mobile presentation styles', () => {
  assert.match(bannerSource, /\.telegram-banner/);
  assert.match(bannerSource, /\.telegram-banner-media/);
  assert.match(bannerSource, /@media \(max-width: 760px\)/);
  assert.match(bannerSource, /grid-template-columns: 1fr/);
});
