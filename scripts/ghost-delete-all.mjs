#!/usr/bin/env node

/**
 * Delete ALL posts from Ghost CMS.
 * Usage: node scripts/ghost-delete-all.mjs
 */

import crypto from 'node:crypto';

const GHOST_ADMIN_URL = process.env.GHOST_ADMIN_URL || 'https://atrani.ru/blog';
const GHOST_ADMIN_KEY = process.env.GHOST_ADMIN_KEY || '6986715c300a3f00014b8f22:263ae6c387e0230b00b367547b0c82d60899fbe13f1cf6bf25253f10597b7ea4';

function createGhostToken(key) {
  const [id, secret] = key.split(':');
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
  function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const h = b64url(header);
  const p = b64url(payload);
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${h}.${p}.${sig}`;
}

async function ghostAdmin(endpoint, options = {}) {
  const token = createGhostToken(GHOST_ADMIN_KEY);
  const res = await fetch(`${GHOST_ADMIN_URL}/ghost/api/admin${endpoint}`, {
    ...options,
    headers: { Authorization: `Ghost ${token}`, ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.substring(0, 200)}`);
  }
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('json')) return res.json();
  return null;
}

async function main() {
  console.log('Fetching all posts...');
  let deleted = 0;
  let page = 1;

  while (true) {
    const data = await ghostAdmin(`/posts/?limit=50&page=${page}&fields=id,slug,title`);
    if (!data.posts || data.posts.length === 0) break;

    for (const post of data.posts) {
      console.log(`  Deleting: ${post.slug} — "${post.title}"`);
      try {
        await ghostAdmin(`/posts/${post.id}/`, { method: 'DELETE' });
        deleted++;
      } catch (e) {
        console.error(`  [ERROR] ${e.message}`);
      }
    }

    // Always page 1 since we're deleting
    if (!data.meta?.pagination?.next) break;
  }

  console.log(`\nDeleted ${deleted} posts.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
