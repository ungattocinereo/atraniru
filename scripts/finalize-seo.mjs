import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const distDirectory = join(projectRoot, 'dist');

export function latestIsoDate(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getTime());

  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

export async function addLastmodToSitemap(xml, resolveLastmod) {
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  let output = xml;

  for (const entry of entries) {
    const block = entry[0];
    if (/<lastmod>/.test(block)) continue;

    const location = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!location) continue;

    const resolved = await resolveLastmod(location);
    const lastmod = latestIsoDate([resolved]);
    if (!lastmod) continue;

    const updatedBlock = block.replace('</loc>', `</loc><lastmod>${lastmod}</lastmod>`);
    output = output.replace(block, updatedBlock);
  }

  return output;
}

function htmlPathForUrl(location) {
  const pathname = decodeURIComponent(new URL(location).pathname).replace(/^\/+|\/+$/g, '');
  return pathname ? join(distDirectory, pathname, 'index.html') : join(distDirectory, 'index.html');
}

function sourcePathForUrl(location) {
  const pathname = new URL(location).pathname.replace(/^\/+|\/+$/g, '');
  if (!pathname) return join(projectRoot, 'src/pages/index.astro');
  if (pathname.startsWith('blog/page/')) return join(projectRoot, 'src/pages/blog/page/[page].astro');
  if (pathname.startsWith('blog/') && pathname !== 'blog') return undefined;
  return join(projectRoot, 'src/pages', `${pathname}.astro`);
}

function contentDatesFromHtml(htmlFile) {
  if (!existsSync(htmlFile)) return [];
  const html = readFileSync(htmlFile, 'utf8');
  return [
    ...[...html.matchAll(/"dateModified"\s*:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/property="article:modified_time" content="([^"]+)"/g)].map((match) => match[1]),
  ];
}

function gitDateForSource(sourceFile) {
  if (!sourceFile || !existsSync(sourceFile)) return undefined;
  try {
    const committedDate = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', relative(projectRoot, sourceFile)],
      { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return committedDate || statSync(sourceFile).mtime.toISOString();
  } catch {
    return statSync(sourceFile).mtime.toISOString();
  }
}

function lastmodForUrl(location) {
  const contentDate = latestIsoDate(contentDatesFromHtml(htmlPathForUrl(location)));
  return contentDate || gitDateForSource(sourcePathForUrl(location));
}

async function finalize() {
  const sitemapFile = join(distDirectory, 'sitemap-0.xml');
  const sitemapIndexFile = join(distDirectory, 'sitemap-index.xml');

  if (!existsSync(sitemapFile)) {
    throw new Error(`Sitemap not found: ${sitemapFile}`);
  }

  const original = readFileSync(sitemapFile, 'utf8');
  const finalized = await addLastmodToSitemap(original, lastmodForUrl);
  writeFileSync(sitemapFile, finalized);

  if (existsSync(sitemapIndexFile)) {
    const lastmods = [...finalized.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
    const newest = latestIsoDate(lastmods);
    if (newest) {
      const indexXml = readFileSync(sitemapIndexFile, 'utf8');
      const withLastmod = indexXml.includes('<lastmod>')
        ? indexXml
        : indexXml.replace('</loc>', `</loc><lastmod>${newest}</lastmod>`);
      writeFileSync(sitemapIndexFile, withLastmod);
    }
  }

  const urlCount = (finalized.match(/<url>/g) || []).length;
  const datedCount = (finalized.match(/<lastmod>/g) || []).length;
  console.log(`[seo] Sitemap finalized: ${urlCount} URLs, ${datedCount} accurate lastmod values.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  finalize().catch((error) => {
    console.error(`[seo] ${error.message}`);
    process.exitCode = 1;
  });
}
