#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_IMAGES = join(ROOT, 'public/images');
const BACKUP_DIR = join(ROOT, 'public/images-original');
const CACHE_FILE = join(__dirname, '.image-cache.json');

const MAX_WIDTH = 2400;
const DEFAULT_QUALITY = 80;
const HERO_QUALITY = 85;

const SKIP_PATHS = [
  '/favicon-',
  '/apple-touch-icon',
  '/icon-',
];

const HERO_PATHS = [
  '/index/atrani-4-index',
  '/index/imagehero',
];

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function sha1(buf) {
  return createHash('sha1').update(buf).digest('hex');
}

function shouldSkip(relPath) {
  return SKIP_PATHS.some(p => relPath.includes(p));
}

function isHero(relPath) {
  return HERO_PATHS.some(p => relPath.includes(p));
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

async function hasBackup() {
  if (!existsSync(BACKUP_DIR)) return false;
  try {
    const entries = await readdir(BACKUP_DIR);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function outputPathFor(relPath) {
  const ext = extname(relPath).toLowerCase();
  if (!RASTER_EXT.has(ext)) return relPath;
  if (shouldSkip(relPath)) return relPath;
  // normalize .webp.jpeg → .webp
  if (relPath.endsWith('.webp.jpeg') || relPath.endsWith('.webp.jpg')) {
    return relPath.replace(/\.webp\.(jpeg|jpg)$/i, '.webp');
  }
  // everything else gets .webp
  return relPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

async function processOne(relPath, buf, cache) {
  const ext = extname(relPath).toLowerCase();
  const outRel = outputPathFor(relPath);
  const outAbs = join(PUBLIC_IMAGES, outRel);

  if (shouldSkip(relPath) || !RASTER_EXT.has(ext)) {
    await mkdir(dirname(outAbs), { recursive: true });
    if (outAbs !== join(PUBLIC_IMAGES, relPath) || !existsSync(outAbs)) {
      await writeFile(outAbs, buf);
    }
    return { relPath, outRel, inSize: buf.length, outSize: buf.length, skipped: true };
  }

  const hash = sha1(buf);
  if (cache[relPath] && cache[relPath].hash === hash && existsSync(outAbs)) {
    const st = await stat(outAbs);
    return { relPath, outRel, inSize: buf.length, outSize: st.size, cached: true };
  }

  const quality = isHero(relPath) ? HERO_QUALITY : DEFAULT_QUALITY;
  let pipeline = sharp(buf, { failOn: 'error' }).rotate();
  const meta = await sharp(buf).metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const outBuf = await pipeline
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer();

  await mkdir(dirname(outAbs), { recursive: true });
  await writeFile(outAbs, outBuf);

  // If output path differs from source path (e.g. .jpg → .webp), remove the old file
  const srcAbs = join(PUBLIC_IMAGES, relPath);
  if (srcAbs !== outAbs && existsSync(srcAbs)) {
    await unlink(srcAbs);
  }

  cache[relPath] = { hash, outRel, outSize: outBuf.length };
  return { relPath, outRel, inSize: buf.length, outSize: outBuf.length };
}

function formatBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function main() {
  if (!existsSync(PUBLIC_IMAGES)) {
    console.error('public/images not found');
    process.exit(1);
  }

  if (!(await hasBackup())) {
    console.log('ℹ️  public/images-original/ not found — skipping optimization.');
    console.log('   This is expected on CI/VPS (originals live only on dev machines).');
    console.log('   Committed public/images/ is treated as the optimized output.');
    return;
  }

  const cache = await loadCache();

  console.log('🔍 Reading backup…');
  const sources = await walk(BACKUP_DIR);
  console.log(`   ${sources.length} files`);

  let totalIn = 0;
  let totalOut = 0;
  let processed = 0;
  let cached = 0;
  let skipped = 0;
  const results = [];

  for (const absSrc of sources) {
    const relPath = relative(BACKUP_DIR, absSrc);
    const buf = await readFile(absSrc);
    const result = await processOne(relPath, buf, cache);
    totalIn += result.inSize;
    totalOut += result.outSize;
    if (result.skipped) skipped++;
    else if (result.cached) cached++;
    else processed++;
    results.push(result);
  }

  await saveCache(cache);

  const top = [...results]
    .filter(r => !r.skipped)
    .sort((a, b) => b.outSize - a.outSize)
    .slice(0, 10);

  console.log(`\n✓ Done. processed=${processed} cached=${cached} skipped=${skipped}`);
  console.log(`   input total:  ${formatBytes(totalIn)}`);
  console.log(`   output total: ${formatBytes(totalOut)}`);
  const savings = totalIn - totalOut;
  const pct = totalIn > 0 ? ((savings / totalIn) * 100).toFixed(1) : 0;
  console.log(`   savings:      ${formatBytes(savings)} (${pct}%)`);
  console.log('\n   top 10 largest after optimization:');
  for (const r of top) {
    console.log(`     ${formatBytes(r.outSize).padStart(10)}  ${r.outRel}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
