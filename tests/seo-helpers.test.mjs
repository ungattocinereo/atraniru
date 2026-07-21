import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaDescription, normalizeArticleHeadings, normalizeLegacyLinks } from '../src/lib/seo.mjs';

test('creates a useful metadata fallback from article HTML', () => {
  const description = createMetaDescription({
    title: 'Парковки на Амальфитанском побережье',
    html: '<h1>Парковки</h1><p>Где оставить машину в Амальфи, Атрани и Равелло без лишнего стресса.</p>',
  });

  assert.equal(description, 'Где оставить машину в Амальфи, Атрани и Равелло без лишнего стресса.');
});

test('prefers editorial metadata and keeps it within the search snippet limit', () => {
  const description = createMetaDescription({
    og_description: `  ${'Очень длинное описание '.repeat(20)}  `,
    title: 'Тест',
  });

  assert.ok(description.length <= 160);
  assert.doesNotMatch(description, /\s{2,}/);
  assert.match(description, /…$/);
});

test('demotes headings embedded in Ghost content so the page keeps one h1', () => {
  const html = '<h1 class="kg-heading">Раздел</h1><h2>Подраздел</h2><H1>Ещё раздел</H1>';

  assert.equal(
    normalizeArticleHeadings(html),
    '<h2 class="kg-heading">Раздел</h2><h2>Подраздел</h2><H2>Ещё раздел</H2>',
  );
});

test('rewrites known legacy internal links to live canonical routes', () => {
  const html = [
    '<a href="https://www.atrani.ru/blog/2020/6/13/naples?ref=atrani.ru">Неаполь</a>',
    '<a href="https://atrani.ru/blog/transport">Транспорт</a>',
    '<a href="https://atrani.ru/blog/directions">Как добраться</a>',
    '<a href="https://atrani.ru/blog/order-photo/couple-photo"></a>',
  ].join('');

  const normalized = normalizeLegacyLinks(html);
  assert.match(normalized, /href="https:\/\/atrani\.ru\/blog\/naples"/);
  assert.match(normalized, /href="https:\/\/atrani\.ru\/transport"/);
  assert.match(normalized, /href="https:\/\/atrani\.ru\/photos" aria-label="Фотосессии на Амальфитанском побережье"/);
  assert.doesNotMatch(normalized, /www\.atrani\.ru|\/blog\/directions|\/blog\/transport|\/blog\/order-photo/);
});

test('repairs obsolete Squarespace routes and downloads found in the live crawl', () => {
  const legacyTargets = [
    'https://atrani.ru/s/FERRY-timetables-Amalfi-Coast.pdf?ref=atrani.ru',
    'https://atrani.ru/blog/files/BUS-timetables.pdf',
    'https://atrani.ru/blog/s/BUS-Sorrento.pdf',
    'https://atrani.ru/blog/2019/2/20/old-photos-of-amalfi?ref=atrani.ru',
    'https://atrani.ru/blog/2019/12/21/katastrofa?ref=atrani.ru',
    'https://atrani.ru/blog/2018/6/29/pesce-allacqua-pazza?ref=atrani.ru',
    'https://atrani.ru/blog/2020/2/1/chiesa-maria-maddalena?ref=atrani.ru',
    'https://atrani.ru/blog/2020/2/9/47-carnevale-maiori-2020?ref=atrani.ru',
    'https://atrani.ru/blog/2019/1/25/colatura-di-alici-di-cetara',
    'https://atrani.ru/blog/2020/3/2/final-carnivale-2020?ref=atrani.ru',
    'https://atrani.ru/blog/2020/4/17/8-businessman-amalfi-interview?ref=atrani.ru',
    'https://atrani.ru/blog/2020/4/28/la-caravella?ref=atrani.ru',
    'https://atrani.ru/blog/2019/atrani?ref=atrani.ru',
    'https://atrani.ru/blog/apts',
    'https://atrani.ru/apts?ref=atrani.ru',
    'https://atrani.ru/reshka?ref=atrani.ru',
    'https://atrani.ru/blog/book',
    'https://atrani.ru/blog/shop',
    'https://atrani.ru/blog/eng',
    'https://atrani.ru/blog/s/recepie-pasta-grangiano.pdf',
  ];
  const html = legacyTargets.map((href) => `<a href="${href}">Ссылка</a>`).join('');
  const normalized = normalizeLegacyLinks(html);

  for (const expected of [
    'https://atrani.ru/transport',
    'https://atrani.ru/blog/2019-2-20-old-photos-of-amalfi',
    'https://atrani.ru/blog/katastrofa',
    'https://atrani.ru/blog/pesce-allacqua-pazza',
    'https://atrani.ru/blog/chiesa-maria-maddalena',
    'https://atrani.ru/blog/carnevale-maiori-2020',
    'https://atrani.ru/blog/colatura-di-alici-di-cetara',
    'https://atrani.ru/blog/final-carnivale-2020',
    'https://atrani.ru/blog/8-businessman-amalfi-interview',
    'https://atrani.ru/blog/la-caravella',
    'https://atrani.ru/blog/2019-atrani',
    'https://atrani.ru/apartments',
    'https://atrani.ru/orel-i-reshka-amalfi',
    'https://atrani.ru/contacts',
    'https://atrani.ru/blog/eng-atrani',
    'https://atrani.ru/blog/visit-pastificio-gentile-grangano',
  ]) {
    assert.match(normalized, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const normalizedHrefs = [...normalized.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const legacyTarget of legacyTargets) {
    assert.ok(!normalizedHrefs.includes(legacyTarget), `${legacyTarget} was not rewritten`);
  }
});

test('removes legacy ref parameters and trailing slashes from same-site links', () => {
  const html = '<a href="https://atrani.ru/transport/?ref=atrani.ru">Транспорт</a>';
  assert.equal(normalizeLegacyLinks(html), '<a href="https://atrani.ru/transport">Транспорт</a>');
});
