import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');

test('AI search crawlers are explicitly allowed and robots points to the canonical sitemap', () => {
  const robots = read('public/robots.txt');

  assert.match(robots, /User-agent:\s*OAI-SearchBot[\s\S]*?Allow:\s*\//);
  assert.match(robots, /User-agent:\s*GPTBot[\s\S]*?Allow:\s*\//);
  assert.match(robots, /Sitemap:\s*https:\/\/atrani\.ru\/sitemap-index\.xml/);
});

test('AI discovery file describes the canonical brand and service URLs', () => {
  const llms = read('public/llms.txt');

  assert.match(llms, /^# Atrani\.ru/m);
  assert.match(llms, /https:\/\/atrani\.ru\/experience/);
  assert.match(llms, /https:\/\/atrani\.ru\/tours-boat/);
  assert.match(llms, /https:\/\/atrani\.ru\/tours-gastronomy/);
  assert.match(llms, /https:\/\/atrani\.ru\/tours-vespa/);
  assert.doesNotMatch(llms, /guaranteed|гарантирован/i);
});

test('blog metadata has a non-empty fallback, one visible h1, and a real publisher logo', () => {
  const layout = read('src/layouts/BlogLayout.astro');
  const article = read('src/pages/blog/[slug]/index.astro');

  assert.match(layout, /createMetaDescription\(post\)/);
  assert.match(layout, /https:\/\/atrani\.ru\/icon-512\.png/);
  assert.match(article, /normalizeArticleHeadings\(rewriteGhostHtml\(post\.html\)\)/);
});

test('blog archive uses crawlable page URLs rather than hiding every post in one document', () => {
  const index = read('src/pages/blog/index.astro');

  assert.match(index, /allPosts\.slice\(0, POSTS_PER_PAGE\)/);
  assert.match(index, /href=\{`\/blog\/page\/\$\{page\}`\}/);
  assert.ok(existsSync(join(root, 'src/pages/blog/page/[page].astro')));
  assert.doesNotMatch(index, /Infinite Scroll/);
});

test('dedicated technical landing pages exist and are linked from the experience hub', () => {
  const experience = read('src/pages/experience.astro');
  const routes = ['tours-boat', 'tours-gastronomy', 'tours-vespa'];

  for (const route of routes) {
    assert.ok(existsSync(join(root, `src/pages/${route}.astro`)), `${route}.astro is missing`);
    assert.match(experience, new RegExp(`href=["']/${route}["']`));
  }
});

test('contact form supports preselected service context for excursion pages', () => {
  const contacts = read('src/pages/contacts.astro');

  assert.match(contacts, /new URLSearchParams\(window\.location\.search\)\.get\('service'\)/);
  assert.match(contacts, /value="boat-tour"/);
  assert.match(contacts, /value="gastronomy-tour"/);
  assert.match(contacts, /value="vespa-tour"/);
});

test('production build finalizes sitemap lastmod values and deploy config covers canonical host and cache headers', () => {
  const pkg = JSON.parse(read('package.json'));
  const caddy = read('Caddyfile');

  assert.match(pkg.scripts.build, /finalize-seo\.mjs/);
  assert.ok(existsSync(join(root, 'scripts/finalize-seo.mjs')));
  assert.match(caddy, /www\.atrani\.ru[\s\S]*redir https:\/\/atrani\.ru\{uri\} 308/);
  assert.match(caddy, /Strict-Transport-Security/);
  assert.match(caddy, /Cache-Control/);
});

test('webhook is only exposed to the local reverse proxy', () => {
  const webhook = read('webhook.mjs');
  assert.match(webhook, /server\.listen\(PORT, '127\.0\.0\.1'/);
});

test('head starts with charset and article schema always has an absolute fallback image', () => {
  const layout = read('src/layouts/Layout.astro');
  const blogLayout = read('src/layouts/BlogLayout.astro');

  assert.match(layout, /<head>\s*<meta charset="UTF-8"/);
  assert.match(blogLayout, /const schemaImage = new URL\(ogImage, siteUrl\)\.href/);
  assert.match(blogLayout, /"image": schemaImage/);
});

test('privacy link resolves and dedicated tours are linked sitewide', () => {
  const contacts = read('src/pages/contacts.astro');
  const layout = read('src/layouts/Layout.astro');

  assert.doesNotMatch(contacts, /href="\/privacy"/);
  assert.match(contacts, /href="\/privacy-policy"/);
  for (const route of ['tours-boat', 'tours-gastronomy', 'tours-vespa']) {
    assert.match(layout, new RegExp(`href=["']/${route}["']`));
  }
});

test('production headers prevent clickjacking', () => {
  const caddy = read('Caddyfile');
  assert.match(caddy, /Content-Security-Policy\s+"frame-ancestors 'self'"/);
  assert.match(caddy, /X-Frame-Options\s+"SAMEORIGIN"/);
});
