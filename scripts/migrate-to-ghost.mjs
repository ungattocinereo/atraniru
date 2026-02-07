#!/usr/bin/env node

/**
 * Migrate blog posts from local markdown files to Ghost CMS.
 *
 * Features:
 * - Picks one featured image per post
 * - Cleans body text (removes image markdown refs)
 * - Appends extra images as a photo gallery at end
 * - Generates custom_excerpt from first ~160 chars of clean text
 * - For posts with NO local images, fetches one from Unsplash
 *
 * Usage:
 *   node scripts/migrate-to-ghost.mjs [--dry-run] [--limit N]
 *
 * Env vars:
 *   GHOST_ADMIN_URL   - Ghost URL (e.g. https://atrani.ru/blog)
 *   GHOST_ADMIN_KEY   - Ghost Admin API key (id:secret format)
 *   UNSPLASH_ACCESS_KEY - Unsplash API access key (optional)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '..', 'blog');

// --- Config ---
const GHOST_ADMIN_URL =
  process.env.GHOST_ADMIN_URL || 'https://atrani.ru/blog';
const GHOST_ADMIN_KEY =
  process.env.GHOST_ADMIN_KEY ||
  '6986715c300a3f00014b8f22:263ae6c387e0230b00b367547b0c82d60899fbe13f1cf6bf25253f10597b7ea4';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT =
  limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// --- JWT token generation for Ghost Admin API ---
function createGhostToken(key) {
  const [id, secret] = key.split(':');
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };

  function base64url(obj) {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signature}`;
}

// --- Ghost Admin API helpers ---
async function ghostAdminFetch(endpoint, options = {}) {
  const token = createGhostToken(GHOST_ADMIN_KEY);
  const url = `${GHOST_ADMIN_URL}/ghost/api/admin${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Ghost ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ghost Admin API ${res.status}: ${text}`);
  }
  return res.json();
}

async function uploadImage(filePath) {
  const token = createGhostToken(GHOST_ADMIN_KEY);
  const url = `${GHOST_ADMIN_URL}/ghost/api/admin/images/upload/`;

  const fileData = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  const mime = mimeTypes[ext] || 'image/jpeg';

  const boundary = `----FormBoundary${crypto.randomBytes(8).toString('hex')}`;
  const fileName = path.basename(filePath);

  const parts = [];
  parts.push(`--${boundary}\r\n`);
  parts.push(
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
  );
  parts.push(`Content-Type: ${mime}\r\n\r\n`);

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileData, footer]);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Ghost ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 422 && text.includes('already exists')) {
      // Try to extract URL from error or just return null
      console.log(`    [skip] Image already exists: ${fileName}`);
      return null;
    }
    throw new Error(
      `Image upload failed (${res.status}): ${text.substring(0, 200)}`
    );
  }

  const data = await res.json();
  return data.images?.[0]?.url || null;
}

async function getExistingSlugs() {
  const slugs = new Set();
  let page = 1;
  while (true) {
    const data = await ghostAdminFetch(
      `/posts/?limit=100&page=${page}&fields=slug`
    );
    for (const post of data.posts) {
      slugs.add(post.slug);
    }
    if (!data.meta?.pagination?.next) break;
    page++;
  }
  return slugs;
}

// --- Unsplash ---
async function fetchUnsplashImage(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('    [warn] No UNSPLASH_ACCESS_KEY set, skipping Unsplash');
    return null;
  }

  const searchQuery = encodeURIComponent(query);
  const url = `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
  });

  if (!res.ok) {
    console.log(`    [warn] Unsplash API error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (!data.results?.length) return null;

  const photo = data.results[0];
  // Use regular size (1080px wide)
  return {
    url: photo.urls.regular,
    credit: photo.user.name,
    link: photo.links.html,
  };
}

// Download an Unsplash image to a temp file, upload to Ghost, then clean up
async function uploadUnsplashToGhost(unsplashUrl, postSlug) {
  const tmpDir = path.join(__dirname, '..', '.tmp-unsplash');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${postSlug}-unsplash.jpg`);

  const res = await fetch(unsplashUrl);
  if (!res.ok) throw new Error(`Failed to download Unsplash image: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmpFile, buffer);

  try {
    const ghostUrl = await uploadImage(tmpFile);
    return ghostUrl;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

// --- Image file matching ---
// article.md references images with _N suffixes (e.g. IMG_123_1.jpg)
// but actual files in directory don't have those suffixes (e.g. IMG_123.jpg)
async function findImageFile(blogDir, reference) {
  if (!reference) return null;

  // Direct match first
  const directPath = path.join(blogDir, reference);
  try {
    await fs.access(directPath);
    return directPath;
  } catch {}

  // Strip _N suffix: DSC3241_DxO_2.jpg -> DSC3241_DxO.jpg
  const base = reference.replace(/(_\d+)(\.\w+)$/, '$2');
  const basePath = path.join(blogDir, base);
  try {
    await fs.access(basePath);
    return basePath;
  } catch {}

  // Fuzzy match: strip all _N suffixes and compare
  const files = await fs.readdir(blogDir);
  const refBase = path
    .basename(reference, path.extname(reference))
    .replace(/_\d+$/, '');

  for (const f of files) {
    if (f === 'article.md') continue;
    const fBase = path.basename(f, path.extname(f)).replace(/_\d+$/, '');
    if (fBase === refBase || f === reference) {
      return path.join(blogDir, f);
    }
  }

  return null;
}

// Get all actual image files in the blog post directory
async function getLocalImages(blogDir) {
  const files = await fs.readdir(blogDir);
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  return files.filter(
    (f) => f !== 'article.md' && imageExts.has(path.extname(f).toLowerCase())
  );
}

// --- Markdown parsing ---
function parseArticleMd(content, dirName) {
  const lines = content.split('\n');
  let title = '';
  const meta = {};
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && line.startsWith('# ')) {
      title = line.substring(2).trim();
      continue;
    }
    if (line === '---') {
      bodyStartIndex = i + 1;
      break;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      meta[key] = value;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim();
  const dateFromDir = dirName.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

  return {
    title: title || meta['Title'] || dirName.replace(/^\d{4}-\d{2}-\d{2}_/, ''),
    slug: meta['Slug'] || dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    date: meta['Date'] || (dateFromDir ? `${dateFromDir}T12:00:00` : null),
    modified: meta['Modified'] || null,
    featuredImage: meta['Featured Image'] || null,
    body,
  };
}

// Extract clean text: remove all image markdown references, remove excessive
// whitespace, but preserve formatting (headers, lists, links, bold, etc.)
function cleanBodyText(body) {
  let text = body;

  // Remove image markdown: ![alt](file)
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  // Remove duplicate image tags that appear on same line (some posts have doubled refs)
  // This is already handled above, but also clean leftover whitespace

  // Remove lines that are only whitespace
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// Extract image references from markdown body
function extractImageRefs(body) {
  const refs = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const [, alt, src] = match;
    // Skip external URLs
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      refs.push({ alt, src });
    }
  }
  // Deduplicate by src
  const seen = new Set();
  return refs.filter((r) => {
    if (seen.has(r.src)) return false;
    seen.add(r.src);
    return true;
  });
}

// Generate excerpt from clean text
function generateExcerpt(cleanText, maxLen = 160) {
  // Strip markdown formatting for excerpt
  let plain = cleanText
    .replace(/^#{1,6}\s+/gm, '') // headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*]\s+/gm, '') // list markers
    .replace(/^\d+\.\s+/gm, '') // ordered list markers
    .replace(/\n+/g, ' ') // newlines to spaces
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();

  if (plain.length <= maxLen) return plain;

  // Truncate at word boundary
  const truncated = plain.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 80 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

// Convert clean markdown to HTML
function markdownToHtml(md) {
  let html = md;

  // Blockquotes
  html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>\n`);

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs
  const lines = html.split('\n');
  const result = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      continue;
    }

    const isBlock =
      /^<(h[1-6]|ul|ol|li|blockquote|figure|img|hr|p|div|table|pre|iframe)/.test(
        trimmed
      );
    if (isBlock) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      result.push(trimmed);
    } else {
      if (!inParagraph) {
        result.push('<p>');
        inParagraph = true;
      }
      result.push(trimmed);
    }
  }
  if (inParagraph) result.push('</p>');

  return result.join('\n');
}

// Build gallery HTML for Ghost (using figure + img tags)
function buildGalleryHtml(imageUrls) {
  if (!imageUrls.length) return '';

  // Ghost supports a gallery card format with kg-gallery
  let html = '\n<hr>\n';
  html += '<!--kg-card-begin: gallery-->\n';
  html += '<figure class="kg-card kg-gallery-card kg-width-wide">\n';
  html += '<div class="kg-gallery-container">\n';

  // Group into rows of 3
  for (let i = 0; i < imageUrls.length; i += 3) {
    const row = imageUrls.slice(i, i + 3);
    html += '<div class="kg-gallery-row">\n';
    for (const url of row) {
      html += `<figure class="kg-gallery-image"><img src="${url}" loading="lazy"></figure>\n`;
    }
    html += '</div>\n';
  }

  html += '</div>\n</figure>\n';
  html += '<!--kg-card-end: gallery-->\n';
  return html;
}

// Build Unsplash credit HTML
function buildUnsplashCredit(credit, link) {
  return `\n<p><em>Photo by <a href="${link}?utm_source=atrani_ru&utm_medium=referral">${credit}</a> on <a href="https://unsplash.com/?utm_source=atrani_ru&utm_medium=referral">Unsplash</a></em></p>`;
}

// --- Normalize date to ISO 8601 ---
function toISO(dateStr) {
  if (!dateStr) return undefined;
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  return dateStr + '.000Z';
}

// --- Derive Unsplash search query from post title ---
function deriveUnsplashQuery(title) {
  // Map common Russian words related to Amalfi Coast to English search terms
  const titleLower = title.toLowerCase();

  if (titleLower.includes('амальфи') || titleLower.includes('атрани'))
    return 'Amalfi Coast Italy';
  if (titleLower.includes('неаполь')) return 'Naples Italy';
  if (titleLower.includes('равелло')) return 'Ravello Italy';
  if (titleLower.includes('позитано')) return 'Positano Italy';
  if (titleLower.includes('салерно')) return 'Salerno Italy';
  if (titleLower.includes('сорренто')) return 'Sorrento Italy';
  if (titleLower.includes('везувий')) return 'Vesuvius Italy';
  if (titleLower.includes('рождеств') || titleLower.includes('презепио'))
    return 'Christmas Italy coast';
  if (titleLower.includes('закат')) return 'sunset Amalfi Coast';
  if (titleLower.includes('фото')) return 'Amalfi Coast photography';
  if (titleLower.includes('карнавал')) return 'Italian carnival';
  if (titleLower.includes('ресторан')) return 'Italian restaurant seafood';
  if (titleLower.includes('пляж')) return 'Amalfi Coast beach';
  if (titleLower.includes('лимон')) return 'Amalfi lemons';
  if (titleLower.includes('паром') || titleLower.includes('переправ'))
    return 'ferry boat Mediterranean';
  if (titleLower.includes('автобус')) return 'Amalfi Coast road';
  if (titleLower.includes('свадьб') || titleLower.includes('влюблён'))
    return 'wedding Amalfi Coast';
  if (titleLower.includes('зим')) return 'winter Amalfi Coast';
  if (titleLower.includes('рецепт') || titleLower.includes('еда') || titleLower.includes('спагетти'))
    return 'Italian food pasta';
  if (titleLower.includes('вин')) return 'Italian wine coast';
  if (titleLower.includes('кот') || titleLower.includes('кошач'))
    return 'cats Mediterranean';

  // Default: Amalfi Coast
  return 'Amalfi Coast Italy sea';
}

// --- Main ---
async function main() {
  console.log(`Ghost Admin URL: ${GHOST_ADMIN_URL}`);
  console.log(`Unsplash API: ${UNSPLASH_ACCESS_KEY ? 'configured' : 'NOT SET (will skip)'}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Limit: ${LIMIT === Infinity ? 'none' : LIMIT}`);
  console.log('');

  // Get all blog directories
  const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
  const blogDirs = entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_/.test(e.name))
    .map((e) => e.name)
    .sort();

  console.log(`Found ${blogDirs.length} blog post directories\n`);

  // Get existing slugs to skip duplicates
  let existingSlugs = new Set();
  if (!DRY_RUN) {
    console.log('Fetching existing posts from Ghost...');
    try {
      existingSlugs = await getExistingSlugs();
      console.log(`Found ${existingSlugs.size} existing posts\n`);
    } catch (e) {
      console.error('Failed to fetch existing posts:', e.message);
      console.log('Continuing anyway...\n');
    }
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let unsplashUsed = 0;

  for (const dirName of blogDirs) {
    if (created >= LIMIT) break;

    const blogDir = path.join(BLOG_DIR, dirName);
    const articlePath = path.join(blogDir, 'article.md');

    try {
      await fs.access(articlePath);
    } catch {
      console.log(`[skip] No article.md in ${dirName}`);
      skipped++;
      continue;
    }

    const content = await fs.readFile(articlePath, 'utf-8');
    const parsed = parseArticleMd(content, dirName);

    if (existingSlugs.has(parsed.slug)) {
      console.log(`[skip] Already exists: ${parsed.slug}`);
      skipped++;
      continue;
    }

    console.log(
      `[${created + 1}] "${parsed.title}" (${parsed.slug})`
    );

    // Get available local images
    const localImages = await getLocalImages(blogDir);
    const hasLocalImages = localImages.length > 0;

    // Extract image references from body
    const imageRefs = extractImageRefs(parsed.body);

    // Clean the body text: remove all image markdown
    const cleanText = cleanBodyText(parsed.body);

    // Generate excerpt
    const excerpt = generateExcerpt(cleanText);

    if (DRY_RUN) {
      console.log(`    Date: ${parsed.date}`);
      console.log(`    Local images: ${localImages.length}`);
      console.log(`    Image refs in text: ${imageRefs.length}`);
      console.log(`    Has local images: ${hasLocalImages}`);
      console.log(`    Featured: ${parsed.featuredImage}`);
      console.log(`    Excerpt: ${excerpt.substring(0, 80)}...`);
      console.log('');
      created++;
      continue;
    }

    try {
      let featureImageUrl = null;
      const galleryUrls = [];

      if (hasLocalImages) {
        // --- STRATEGY FOR POSTS WITH LOCAL IMAGES ---

        // 1. Determine the featured image
        //    Priority: metadata Featured Image → first image ref in body → first file in dir
        let featuredFile = null;

        if (parsed.featuredImage) {
          featuredFile = await findImageFile(blogDir, parsed.featuredImage);
        }
        if (!featuredFile && imageRefs.length > 0) {
          featuredFile = await findImageFile(blogDir, imageRefs[0].src);
        }
        if (!featuredFile && localImages.length > 0) {
          featuredFile = path.join(blogDir, localImages[0]);
        }

        // Upload featured image
        if (featuredFile) {
          console.log(`    Featured: ${path.basename(featuredFile)}`);
          try {
            featureImageUrl = await uploadImage(featuredFile);
          } catch (e) {
            console.error(
              `    [warn] Featured image upload failed: ${e.message}`
            );
          }
        }

        // 2. Determine which images are already referenced in text vs extra
        const referencedFiles = new Set();
        for (const ref of imageRefs) {
          const f = await findImageFile(blogDir, ref.src);
          if (f) referencedFiles.add(path.basename(f));
        }
        // Also count featured image as referenced
        if (featuredFile) referencedFiles.add(path.basename(featuredFile));

        // 3. Upload all extra images (not referenced in text, not featured) for gallery
        const extraImages = localImages.filter(
          (f) => !referencedFiles.has(f)
        );

        if (extraImages.length > 0) {
          console.log(`    Gallery: ${extraImages.length} extra images`);
        }

        for (const img of extraImages) {
          const imgPath = path.join(blogDir, img);
          try {
            const url = await uploadImage(imgPath);
            if (url) galleryUrls.push(url);
          } catch (e) {
            console.error(
              `    [warn] Gallery image upload failed (${img}): ${e.message}`
            );
          }
        }

        // 4. Also upload referenced images (from text) that aren't the featured image
        //    These go into the gallery too since we remove all images from text
        for (const ref of imageRefs) {
          const f = await findImageFile(blogDir, ref.src);
          if (f && featuredFile && path.basename(f) === path.basename(featuredFile)) {
            continue; // skip the featured image
          }
          if (f) {
            try {
              const url = await uploadImage(f);
              if (url) galleryUrls.push(url);
            } catch (e) {
              console.error(
                `    [warn] Image upload failed (${ref.src}): ${e.message}`
              );
            }
          }
        }
      } else {
        // --- STRATEGY FOR POSTS WITHOUT LOCAL IMAGES: Unsplash ---
        const query = deriveUnsplashQuery(parsed.title);
        console.log(`    No local images, searching Unsplash: "${query}"`);

        const unsplash = await fetchUnsplashImage(query);
        if (unsplash) {
          try {
            featureImageUrl = await uploadUnsplashToGhost(
              unsplash.url,
              parsed.slug
            );
            if (featureImageUrl) {
              console.log(`    Unsplash: ${unsplash.credit}`);
              unsplashUsed++;
            }
          } catch (e) {
            console.error(`    [warn] Unsplash upload failed: ${e.message}`);
          }
        }
      }

      // Convert clean text to HTML
      const htmlBody = markdownToHtml(cleanText);

      // Append gallery if we have extra images
      const galleryHtml = buildGalleryHtml(galleryUrls);

      const fullHtml = htmlBody + galleryHtml;

      // Create post via Admin API
      const postData = {
        posts: [
          {
            title: parsed.title,
            slug: parsed.slug,
            html: fullHtml,
            status: 'published',
            published_at: toISO(parsed.date),
            feature_image: featureImageUrl || undefined,
            custom_excerpt: excerpt || undefined,
          },
        ],
      };

      await ghostAdminFetch('/posts/?source=html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      console.log(`    -> Created!\n`);
      created++;
      existingSlugs.add(parsed.slug);
    } catch (e) {
      console.error(`    [ERROR] ${e.message}\n`);
      errors++;
    }
  }

  // Cleanup tmp dir
  try {
    await fs.rm(path.join(__dirname, '..', '.tmp-unsplash'), {
      recursive: true,
      force: true,
    });
  } catch {}

  console.log('\n=== Summary ===');
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors}`);
  console.log(`Unsplash images used: ${unsplashUsed}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
