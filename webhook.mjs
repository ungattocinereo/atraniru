#!/usr/bin/env node

/**
 * Webhook server for Atrani.ru auto-rebuild.
 *
 * Handles two webhook sources:
 *   1. Ghost CMS  → POST /webhook/rebuild        (post publish/update/delete)
 *   2. GitHub      → POST /hooks/redeploy-atrani-ru  (git push to main)
 *
 * Ghost uses x-ghost-signature header: "sha256=<hash>, t=<timestamp>"
 * GitHub uses x-hub-signature-256 header: "sha256=<hash>"
 *
 * Environment variables (loaded from .env):
 *   WEBHOOK_SECRET  - Ghost webhook secret
 *   GITHUB_WEBHOOK_SECRET - GitHub webhook secret
 *   WEBHOOK_PORT    - port to listen on (default: 40003)
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
const PORT = parseInt(process.env.WEBHOOK_PORT || '40003', 10);
const REBUILD_SCRIPT = resolve(__dirname, 'rebuild.sh');

if (!GHOST_SECRET && !GITHUB_SECRET) {
  console.error('[webhook] Neither WEBHOOK_SECRET nor GITHUB_WEBHOOK_SECRET set — exiting');
  process.exit(1);
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
  console.log(`[webhook] Ghost:  POST /webhook/rebuild`);
  console.log(`[webhook] GitHub: POST /hooks/redeploy-atrani-ru`);
  console.log(`[webhook] Health: GET  /webhook/health`);
  console.log(`[webhook] Secrets: Ghost=${GHOST_SECRET ? 'set' : 'MISSING'}, GitHub=${GITHUB_SECRET ? 'set' : 'MISSING'}`);
});
