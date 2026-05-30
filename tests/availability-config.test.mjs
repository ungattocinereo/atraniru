import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apartmentsPage = readFileSync(new URL('../src/pages/apartments.astro', import.meta.url), 'utf8');
const availabilityScript = readFileSync(new URL('../scripts/check-availability.mjs', import.meta.url), 'utf8');

function parseConfigBlocks(source) {
  const blocks = new Map();
  const blockPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?\n\s*\}/g;
  for (const match of source.matchAll(blockPattern)) {
    blocks.set(match[1], match[0]);
  }
  return blocks;
}

test('all apartment calendar ids have matching availability feeds', () => {
  const pageBlocks = parseConfigBlocks(apartmentsPage);
  const feedBlocks = parseConfigBlocks(availabilityScript);

  const pageCalendarIds = [...pageBlocks]
    .filter(([, block]) => !block.includes('inquiryOnly: true'))
    .map(([id]) => id)
    .sort();

  const feedIds = [...feedBlocks.keys()].sort();

  assert.deepEqual(feedIds, pageCalendarIds);
});

test('Bunkbed Room uses its Booking and Airbnb calendars', () => {
  const feedBlocks = parseConfigBlocks(availabilityScript);
  const bunkbed = feedBlocks.get('bunkbed-room') || '';

  assert.match(bunkbed, /940e8ee6-25a3-4966-9eab-c83b54827e78/);
  assert.match(bunkbed, /1624089061068359230\.ics\?t=7cbf451bfed643a5a403dd2d9489df63/);
});
