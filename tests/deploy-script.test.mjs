import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const deployPath = new URL('../deploy.sh', import.meta.url);
const rebuildPath = new URL('../rebuild.sh', import.meta.url);
const [deploy, rebuild] = await Promise.all([
  readFile(deployPath, 'utf8'),
  readFile(rebuildPath, 'utf8'),
]);

test('deployment scripts have valid Bash syntax', () => {
  for (const path of [deployPath, rebuildPath]) {
    const result = spawnSync('bash', ['-n', path.pathname], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('full deployment uses the production topology and serializes runs', () => {
  assert.match(deploy, /\/srv\/atraniru/);
  assert.match(deploy, /set -Eeuo pipefail/);
  assert.match(deploy, /flock -n/);
  assert.match(deploy, /git fetch origin main/);
  assert.match(deploy, /git merge --ff-only origin\/main/);
  assert.match(deploy, /git status --porcelain/);
  assert.match(deploy, /atraniru-webhook\.service/);
  assert.match(deploy, /127\.0\.0\.1:13103\/webhook\/health/);
});

test('site is built in an isolated release and checked before activation', () => {
  assert.match(deploy, /git archive HEAD/);
  assert.match(deploy, /mktemp -d/);
  assert.match(deploy, /dist\/index\.html/);
  assert.match(deploy, /dist\/sitemap-index\.xml/);
  assert.match(deploy, /dist\/llms\.txt/);
  assert.match(deploy, /\/srv\/atraniru-backups/);
});

test('deployment preserves the shared Caddy configuration', () => {
  assert.match(deploy, /systemctl reload caddy/);
  assert.doesNotMatch(deploy, /(?:cp|install).*Caddyfile.*\/etc\/caddy\/Caddyfile/);
});

test('webhook rebuild delegates to the same safe release path', () => {
  assert.match(rebuild, /deploy\.sh["']? --rebuild-only/);
  assert.doesNotMatch(rebuild, /git pull/);
  assert.doesNotMatch(rebuild, /npm run build/);
});
