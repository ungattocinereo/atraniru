import test from 'node:test';
import assert from 'node:assert/strict';
import { addLastmodToSitemap, latestIsoDate } from '../scripts/finalize-seo.mjs';

test('adds accurate lastmod values without changing URLs', async () => {
  const xml = '<?xml version="1.0"?><urlset><url><loc>https://atrani.ru/</loc></url><url><loc>https://atrani.ru/blog/post</loc></url></urlset>';
  const dates = new Map([
    ['https://atrani.ru/', '2026-06-10T12:00:00.000Z'],
    ['https://atrani.ru/blog/post', '2026-07-18T08:30:00.000Z'],
  ]);

  const result = await addLastmodToSitemap(xml, (url) => dates.get(url));

  assert.match(result, /<loc>https:\/\/atrani\.ru\/<\/loc><lastmod>2026-06-10T12:00:00\.000Z<\/lastmod>/);
  assert.match(result, /<loc>https:\/\/atrani\.ru\/blog\/post<\/loc><lastmod>2026-07-18T08:30:00\.000Z<\/lastmod>/);
  assert.equal((result.match(/<loc>/g) || []).length, 2);
});

test('chooses the latest valid content date', () => {
  assert.equal(
    latestIsoDate(['invalid', '2026-01-01T00:00:00Z', '2026-07-18T08:30:00Z']),
    '2026-07-18T08:30:00.000Z',
  );
});
