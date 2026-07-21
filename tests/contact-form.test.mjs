import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const webhookSource = readFileSync(new URL('../webhook.mjs', import.meta.url), 'utf8');
const contactsPage = readFileSync(new URL('../src/pages/contacts.astro', import.meta.url), 'utf8');

test('too-fast contact submissions are not reported as delivered', () => {
  const tooFastBlock = webhookSource.match(
    /Date\.now\(\) - startedAt < CONTACT_MIN_FORM_FILL_MS[\s\S]*?return;\n\s*\}/,
  )?.[0] || '';

  assert.match(tooFastBlock, /res\.writeHead\(425/);
  assert.match(tooFastBlock, /Submission too fast/);
  assert.doesNotMatch(tooFastBlock, /\{ ok: true \}/);
});

test('contact form send failures include the mail@atrani.ru fallback', () => {
  assert.match(contactsPage, /const FALLBACK_EMAIL = 'mail@atrani\.ru';/);
  assert.match(contactsPage, /Не удалось отправить[\s\S]*\$\{FALLBACK_EMAIL\}/);
  assert.match(contactsPage, /Ошибка сети[\s\S]*\$\{FALLBACK_EMAIL\}/);
  assert.doesNotMatch(contactsPage, /напишите на hello@atrani\.ru/i);
});
