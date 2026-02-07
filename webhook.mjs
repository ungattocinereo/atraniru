#!/usr/bin/env node

/**
 * Lightweight webhook server for Ghost CMS → Astro rebuild.
 *
 * When Ghost publishes/updates/deletes a post, it sends a POST request here.
 * This server verifies the Ghost HMAC-SHA256 signature and runs rebuild.sh.
 *
 * Ghost sends the signature in the header: x-ghost-signature
 * Format: "sha256=<hash>, t=<timestamp>"
 * The hash is computed as: HMAC-SHA256(secret, body + timestamp)
 *
 * Environment variables (loaded from .env):
 *   WEBHOOK_SECRET  - shared secret (same as in Ghost webhook settings)
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

const SECRET = process.env.WEBHOOK_SECRET;
const PORT = parseInt(process.env.WEBHOOK_PORT || '40003', 10);
const REBUILD_SCRIPT = resolve(__dirname, 'rebuild.sh');

if (!SECRET) {
  console.error('[webhook] WEBHOOK_SECRET not set in .env — exiting');
  process.exit(1);
}

let rebuilding = false;
let pendingRebuild = false;

function runRebuild() {
  if (rebuilding) {
    pendingRebuild = true;
    console.log('[webhook] Rebuild already in progress, queued another');
    return;
  }

  rebuilding = true;
  pendingRebuild = false;
  const startTime = Date.now();

  console.log(`[webhook] Starting rebuild at ${new Date().toISOString()}`);

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
      runRebuild();
    }
  });
}

/**
 * Verify Ghost webhook HMAC-SHA256 signature.
 *
 * Ghost header format: "sha256=<hex_hash>, t=<timestamp>"
 * Signed payload: body + timestamp
 */
function verifyGhostSignature(signature, body) {
  if (!signature) return false;

  try {
    // Parse "sha256=abc123, t=1234567890"
    const parts = {};
    for (const part of signature.split(', ')) {
      const [key, value] = part.split('=');
      parts[key] = value;
    }

    const hash = parts['sha256'];
    const timestamp = parts['t'];

    if (!hash || !timestamp) return false;

    // Ghost signs: body + timestamp
    const expectedHash = createHmac('sha256', SECRET)
      .update(body + timestamp)
      .digest('hex');

    // Timing-safe comparison
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');

    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    console.warn('[webhook] Signature verification error:', err.message);
    return false;
  }
}

const server = createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/webhook/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rebuilding }));
    return;
  }

  // Rebuild endpoint
  if (req.method === 'POST' && req.url?.startsWith('/webhook/rebuild')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Verify Ghost HMAC signature from x-ghost-signature header
      const ghostSignature = req.headers['x-ghost-signature'];

      if (!ghostSignature) {
        console.warn(`[webhook] Missing x-ghost-signature from ${req.socket.remoteAddress}`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing signature' }));
        return;
      }

      if (!verifyGhostSignature(ghostSignature, body)) {
        console.warn(`[webhook] Invalid signature from ${req.socket.remoteAddress}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid signature' }));
        return;
      }

      console.log(`[webhook] Valid Ghost webhook received`);

      // Accept immediately, rebuild async
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'rebuild_triggered', queued: rebuilding }));

      runRebuild();
    });
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[webhook] Listening on 127.0.0.1:${PORT}`);
  console.log(`[webhook] Rebuild endpoint: POST /webhook/rebuild`);
  console.log(`[webhook] Ghost verifies via x-ghost-signature HMAC-SHA256`);
  console.log(`[webhook] Health check:     GET  /webhook/health`);
});
