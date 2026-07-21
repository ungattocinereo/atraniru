#!/usr/bin/env node

/**
 * Webhook server for Atrani.ru.
 *
 * Handles three sources:
 *   1. Ghost CMS    → POST /webhook/rebuild              (post publish/update/delete)
 *   2. GitHub       → POST /hooks/redeploy-atrani-ru     (git push to main)
 *   3. Contact form → POST /hooks/send-telegram-atrani   (public, hardened)
 *   4. Newsletter   → POST /hooks/subscribe-atrani-newsletter (Ghost member signup)
 *
 * Ghost uses x-ghost-signature header: "sha256=<hash>, t=<timestamp>"
 * GitHub uses x-hub-signature-256 header: "sha256=<hash>"
 * Contact form is public; protected by honeypot + timing check + rate limit.
 *
 * Environment variables (loaded from .env):
 *   WEBHOOK_SECRET        - Ghost webhook secret
 *   GITHUB_WEBHOOK_SECRET - GitHub webhook secret
 *   TELEGRAM_BOT_TOKEN    - Telegram bot token (shared with amalfi.day)
 *   TELEGRAM_CHAT_ID      - Destination chat/channel ID
 *   GHOST_ADMIN_API_KEY   - Ghost Admin API key for member creation
 *   GHOST_NEWSLETTER_ID   - Optional Ghost newsletter id to subscribe members to
 *   WEBHOOK_PORT          - port to listen on (default: 13103)
 */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dependencies needed)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional if vars are set in environment
  }
}

loadEnv();

const GHOST_SECRET = process.env.WEBHOOK_SECRET;
const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GHOST_ADMIN_URL = process.env.GHOST_ADMIN_URL || process.env.GHOST_URL;
const GHOST_ADMIN_API_KEY = process.env.GHOST_ADMIN_API_KEY;
const GHOST_NEWSLETTER_ID = process.env.GHOST_NEWSLETTER_ID;
const PORT = parseInt(process.env.WEBHOOK_PORT || '13103', 10);
const REBUILD_SCRIPT = resolve(__dirname, 'rebuild.sh');

if (!GHOST_SECRET && !GITHUB_SECRET && !(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)) {
  console.error('[webhook] No secrets configured (Ghost, GitHub, or Telegram) — exiting');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn('[webhook] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — contact form will return 500');
}

if (!GHOST_ADMIN_URL || !GHOST_ADMIN_API_KEY) {
  console.warn('[webhook] GHOST_ADMIN_URL / GHOST_ADMIN_API_KEY not set — newsletter form will return 500');
}

// ---- Public form constants, rate limit, helpers ----

const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX = 6;
const CONTACT_MIN_FORM_FILL_MS = 1000;
const CONTACT_SPAM_WORDS = /\b(casino|porn|viagra|forex|escort|betting)\b/i;
const NEWSLETTER_RATE_LIMIT_MAX = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_FIELD_LIMITS = {
  name: 80,
  contact: 120,
  dates: 160,
  service: 80,
  message: 2000,
};

const contactRequestBuckets = new Map();
const newsletterRequestBuckets = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countLinks(value) {
  return (String(value || '').match(/https?:\/\/|www\./gi) || []).length;
}

function isSpamText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (CONTACT_SPAM_WORDS.test(text)) return true;
  if (countLinks(text) > 1) return true;
  return /<a\s|<script|href=/i.test(text);
}

function withinLimit(value, maxLength) {
  return String(value || '').length <= maxLength;
}

function takeRateLimitSlot(ip) {
  const now = Date.now();
  const bucket = contactRequestBuckets.get(ip) || [];
  const fresh = bucket.filter((entry) => now - entry < CONTACT_RATE_WINDOW_MS);

  if (fresh.length >= CONTACT_RATE_LIMIT_MAX) {
    const retryAfterMs = CONTACT_RATE_WINDOW_MS - (now - fresh[0]);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  fresh.push(now);
  contactRequestBuckets.set(ip, fresh);
  return { allowed: true, retryAfterSec: 0 };
}

function takeNewsletterRateLimitSlot(ip) {
  const now = Date.now();
  const bucket = newsletterRequestBuckets.get(ip) || [];
  const fresh = bucket.filter((entry) => now - entry < CONTACT_RATE_WINDOW_MS);

  if (fresh.length >= NEWSLETTER_RATE_LIMIT_MAX) {
    const retryAfterMs = CONTACT_RATE_WINDOW_MS - (now - fresh[0]);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  fresh.push(now);
  newsletterRequestBuckets.set(ip, fresh);
  return { allowed: true, retryAfterSec: 0 };
}

function headerValue(req, key) {
  const value = req.headers[key];
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

function payloadString(payload, key) {
  const value = payload?.[key];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clientIp(req, payload = {}) {
  const forwardedFor = headerValue(req, 'x-forwarded-for');
  return (
    (forwardedFor ? forwardedFor.split(',')[0].trim() : '') ||
    headerValue(req, 'x-real-ip') ||
    headerValue(req, 'cf-connecting-ip') ||
    payloadString(payload, 'ip') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createGhostAdminToken() {
  const [id, secret] = String(GHOST_ADMIN_API_KEY || '').split(':');
  if (!id || !secret) {
    throw new Error('Invalid Ghost Admin API key');
  }

  const iat = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id }));
  const payload = base64Url(JSON.stringify({ iat, exp: iat + 5 * 60, aud: '/admin/' }));
  const signature = createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

async function createGhostMember(email) {
  if (!GHOST_ADMIN_URL || !GHOST_ADMIN_API_KEY) {
    throw new Error('Missing Ghost Admin configuration');
  }

  const member = {
    email,
    labels: [{ name: 'Atrani.ru newsletter', slug: 'atraniru-newsletter' }],
  };

  if (GHOST_NEWSLETTER_ID) {
    member.newsletters = [{ id: GHOST_NEWSLETTER_ID }];
  }

  const ghostBaseUrl = GHOST_ADMIN_URL.endsWith('/') ? GHOST_ADMIN_URL : `${GHOST_ADMIN_URL}/`;
  const url = new URL('ghost/api/admin/members/', ghostBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Ghost ${createGhostAdminToken()}`,
      'Accept-Version': 'v5.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ members: [member] }),
  });

  if (response.ok) {
    return;
  }

  const body = await response.text();
  if (response.status === 422 && /already exists|Member already exists|Validation error/i.test(body)) {
    return;
  }

  throw new Error(`Ghost member signup failed: ${response.status}`);
}

async function handleNewsletterSignup(req, res) {
  setCors(res);

  const body = await collectBody(req);
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const ip = clientIp(req, payload);
  const honeypot = pickString(
    payloadString(payload, 'company_website'),
    payloadString(payload, 'company'),
    payloadString(payload, 'website'),
  );
  if (honeypot) {
    console.log(`[webhook] Newsletter: honeypot triggered from ${ip}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const rate = takeNewsletterRateLimitSlot(ip);
  if (!rate.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': String(rate.retryAfterSec),
    });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
    return;
  }

  const email = payloadString(payload, 'email').toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid email' }));
    return;
  }

  try {
    await createGhostMember(email);
    console.log(`[webhook] Newsletter: subscribed ${email}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[webhook] Newsletter:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not subscribe' }));
  }
}

async function handleContactForm(req, res) {
  setCors(res);

  const body = await collectBody(req);
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const ip = clientIp(req, payload);

  const honeypot = pickString(
    payloadString(payload, 'company_website'),
    payloadString(payload, 'company'),
    payloadString(payload, 'website'),
  );
  if (honeypot) {
    console.log(`[webhook] Contact: honeypot triggered from ${ip}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const startedAt = Number(payload?._form_started_at ?? payload?.form_started_at);
  if (
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    Date.now() - startedAt < CONTACT_MIN_FORM_FILL_MS
  ) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((CONTACT_MIN_FORM_FILL_MS - (Date.now() - startedAt)) / 1000),
    );
    console.log(`[webhook] Contact: too-fast submission from ${ip}`);
    res.writeHead(425, {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    });
    res.end(JSON.stringify({ error: 'Submission too fast' }));
    return;
  }

  const rate = takeRateLimitSlot(ip);
  if (!rate.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': String(rate.retryAfterSec),
    });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
    return;
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[webhook] Contact: missing Telegram credentials');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing Telegram credentials' }));
    return;
  }

  const name = payloadString(payload, 'name');
  const contact = payloadString(payload, 'contact');
  const dates = payloadString(payload, 'dates');
  const service = payloadString(payload, 'service');
  const message = payloadString(payload, 'message');

  if (!contact || !message) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required fields' }));
    return;
  }

  if (
    !withinLimit(name, CONTACT_FIELD_LIMITS.name) ||
    !withinLimit(contact, CONTACT_FIELD_LIMITS.contact) ||
    !withinLimit(dates, CONTACT_FIELD_LIMITS.dates) ||
    !withinLimit(service, CONTACT_FIELD_LIMITS.service) ||
    !withinLimit(message, CONTACT_FIELD_LIMITS.message)
  ) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid field length' }));
    return;
  }

  const phoneDigits = contact.replace(/\D/g, '');
  if (!EMAIL_REGEX.test(contact) && phoneDigits.length < 7) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid contact field' }));
    return;
  }

  if (countLinks(contact) > 0 || isSpamText(name) || isSpamText(dates) || isSpamText(message)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rejected as spam' }));
    return;
  }

  const payloadLocation = payloadString(payload, 'location');
  const payloadCoords = payloadString(payload, 'coords');
  const location = payloadLocation || 'unknown';
  const coords = payloadCoords || 'unknown';
  const userAgent =
    pickString(headerValue(req, 'user-agent'), payloadString(payload, 'userAgent')) || 'unknown';
  const referer =
    pickString(
      headerValue(req, 'referer'),
      payloadString(payload, 'referrer'),
      payloadString(payload, 'page'),
    ) || 'unknown';
  const language =
    pickString(headerValue(req, 'accept-language'), payloadString(payload, 'language')) ||
    'unknown';
  const timezone = payloadString(payload, 'timezone') || 'unknown';
  const timestamp = new Date().toISOString();

  const safeName = escapeHtml(name || '—');
  const safeContact = escapeHtml(contact);
  const safeDates = escapeHtml(dates || '—');
  const safeService = escapeHtml(service || '—');
  const safeMessage = escapeHtml(message);

  const technical = [
    `ip: ${ip}`,
    `location: ${location}`,
    `coords: ${coords}`,
    `user_agent: ${userAgent}`,
    `referrer: ${referer}`,
    `locale: ${language}`,
    `timezone: ${timezone}`,
    `time: ${timestamp}`,
  ].join('\n');

  const text = [
    '📩 New 🟣  Atrani.ru 🇷🇺🇷🇺🇷🇺 inquiry',
    '',
    `👤 <b>Имя:</b> ${safeName}`,
    `📞 <b>Контакт:</b> ${safeContact}`,
    `🧭 <b>Услуга:</b> ${safeService}`,
    `📅 <b>Даты и место:</b> ${safeDates}`,
    `💬 <b>Сообщение:</b> ${safeMessage}`,
    '',
    '🧾 <b>Technical</b>',
    `<pre>${escapeHtml(technical)}</pre>`,
  ].join('\n');

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      console.error('[webhook] Contact: Telegram API failed:', details.slice(0, 200));
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Telegram request failed', details: details.slice(0, 200) }),
      );
      return;
    }

    console.log(`[webhook] Contact: delivered to Telegram from ${ip}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[webhook] Contact: fetch failed:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Telegram request failed' }));
  }
}

let rebuilding = false;
let pendingRebuild = false;

function runRebuild(source) {
  if (rebuilding) {
    pendingRebuild = true;
    console.log(`[webhook] Rebuild already in progress, queued (source: ${source})`);
    return;
  }

  rebuilding = true;
  pendingRebuild = false;
  const startTime = Date.now();

  console.log(`[webhook] Starting rebuild (source: ${source}) at ${new Date().toISOString()}`);

  execFile('/bin/bash', [REBUILD_SCRIPT], { cwd: __dirname }, (error, stdout, stderr) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (error) {
      console.error(`[webhook] Rebuild FAILED after ${duration}s:`, error.message);
      if (stderr) console.error('[webhook] stderr:', stderr);
    } else {
      console.log(`[webhook] Rebuild SUCCESS in ${duration}s`);
    }

    if (stdout) console.log('[webhook] stdout:', stdout);

    rebuilding = false;

    if (pendingRebuild) {
      console.log('[webhook] Running queued rebuild...');
      runRebuild('queued');
    }
  });
}

/**
 * Verify Ghost webhook HMAC-SHA256 signature.
 * Header format: "sha256=<hex_hash>, t=<timestamp>"
 * Signed payload: body + timestamp
 */
function verifyGhostSignature(signature, body) {
  if (!signature || !GHOST_SECRET) return false;

  try {
    const parts = {};
    for (const part of signature.split(', ')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      parts[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
    }

    const hash = parts['sha256'];
    const timestamp = parts['t'];
    if (!hash || !timestamp) return false;

    const expectedHash = createHmac('sha256', GHOST_SECRET)
      .update(body + timestamp)
      .digest('hex');

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    console.warn('[webhook] Ghost signature error:', err.message);
    return false;
  }
}

/**
 * Verify GitHub webhook HMAC-SHA256 signature.
 * Header format: "sha256=<hex_hash>"
 * Signed payload: raw body
 */
function verifyGithubSignature(signature, body) {
  if (!signature || !GITHUB_SECRET) return false;

  try {
    // Header: "sha256=abc123..."
    const hash = signature.replace('sha256=', '');

    const expectedHash = createHmac('sha256', GITHUB_SECRET)
      .update(body)
      .digest('hex');

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    console.warn('[webhook] GitHub signature error:', err.message);
    return false;
  }
}

/**
 * Collect request body as a string.
 */
function collectBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

const server = createServer(async (req, res) => {
  // CORS preflight for the public contact endpoint
  if (req.method === 'OPTIONS' && req.url === '/hooks/send-telegram-atrani') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // CORS preflight for the public newsletter endpoint
  if (req.method === 'OPTIONS' && req.url === '/hooks/subscribe-atrani-newsletter') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Contact form (public, hardened)
  if (req.method === 'POST' && req.url === '/hooks/send-telegram-atrani') {
    await handleContactForm(req, res);
    return;
  }

  // Newsletter signup (public, hardened)
  if (req.method === 'POST' && req.url === '/hooks/subscribe-atrani-newsletter') {
    await handleNewsletterSignup(req, res);
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/webhook/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rebuilding }));
    return;
  }

  // Ghost webhook: post publish/update/delete
  if (req.method === 'POST' && req.url?.startsWith('/webhook/rebuild')) {
    const body = await collectBody(req);
    const ghostSignature = req.headers['x-ghost-signature'];

    if (!ghostSignature) {
      console.warn(`[webhook] Ghost: missing signature from ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing signature' }));
      return;
    }

    if (!verifyGhostSignature(ghostSignature, body)) {
      console.warn(`[webhook] Ghost: invalid signature from ${req.socket.remoteAddress}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid signature' }));
      return;
    }

    console.log('[webhook] Ghost: valid webhook received');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'rebuild_triggered', queued: rebuilding }));
    runRebuild('ghost');
    return;
  }

  // GitHub webhook: git push
  if (req.method === 'POST' && req.url === '/hooks/redeploy-atrani-ru') {
    const body = await collectBody(req);
    const ghSignature = req.headers['x-hub-signature-256'];

    if (!ghSignature) {
      console.warn(`[webhook] GitHub: missing signature from ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing signature' }));
      return;
    }

    if (!verifyGithubSignature(ghSignature, body)) {
      console.warn(`[webhook] GitHub: invalid signature from ${req.socket.remoteAddress}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid signature' }));
      return;
    }

    // Only rebuild on push to main branch
    try {
      const payload = JSON.parse(body);
      if (payload.ref && payload.ref !== 'refs/heads/main') {
        console.log(`[webhook] GitHub: ignoring push to ${payload.ref}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ignored', reason: 'not main branch' }));
        return;
      }
    } catch {
      // If body isn't JSON, rebuild anyway
    }

    console.log('[webhook] GitHub: valid push webhook received');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'rebuild_triggered', queued: rebuilding }));
    runRebuild('github');
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[webhook] Listening on 127.0.0.1:${PORT}`);
  console.log(`[webhook] Ghost:   POST /webhook/rebuild`);
  console.log(`[webhook] GitHub:  POST /hooks/redeploy-atrani-ru`);
  console.log(`[webhook] Contact: POST /hooks/send-telegram-atrani`);
  console.log(`[webhook] News:    POST /hooks/subscribe-atrani-newsletter`);
  console.log(`[webhook] Health:  GET  /webhook/health`);
  console.log(
    `[webhook] Secrets: Ghost=${GHOST_SECRET ? 'set' : 'MISSING'}, GitHub=${GITHUB_SECRET ? 'set' : 'MISSING'}, Telegram=${TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? 'set' : 'MISSING'}, GhostAdmin=${GHOST_ADMIN_URL && GHOST_ADMIN_API_KEY ? 'set' : 'MISSING'}, Newsletter=${GHOST_NEWSLETTER_ID ? 'set' : 'default'}`,
  );
});
