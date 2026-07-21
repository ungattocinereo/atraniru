import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCloudinaryFetchUrl,
  buildCloudinarySrcSet,
  buildGhostSizeUrl,
  buildGhostSrcSet,
  getResponsiveWidths,
  isGhostImageUrl,
} from '../src/lib/imageUrls.mjs';

test('detects atrani.ru Ghost content image URLs', () => {
  assert.equal(isGhostImageUrl('https://atrani.ru/blog/content/images/2026/05/newnewnew.jpg'), true);
  assert.equal(isGhostImageUrl('/blog/content/images/2026/05/newnewnew.jpg'), true);
  assert.equal(isGhostImageUrl('https://atrani.ru/images/index/imagehero.webp'), false);
  assert.equal(isGhostImageUrl('https://example.com/blog/content/images/2026/05/newnewnew.jpg'), false);
});

test('builds Ghost size URLs from original and existing size URLs', () => {
  assert.equal(
    buildGhostSizeUrl('https://atrani.ru/blog/content/images/2026/05/newnewnew.jpg', 480),
    'https://atrani.ru/blog/content/images/size/w600/2026/05/newnewnew.jpg',
  );

  assert.equal(
    buildGhostSizeUrl('https://atrani.ru/blog/content/images/2026/05/newnewnew.jpg', 960),
    'https://atrani.ru/blog/content/images/size/w960/2026/05/newnewnew.jpg',
  );

  assert.equal(
    buildGhostSizeUrl('https://atrani.ru/blog/content/images/size/w600/2026/05/newnewnew.jpg', 1600),
    'https://atrani.ru/blog/content/images/size/w1600/2026/05/newnewnew.jpg',
  );
});

test('builds Ghost srcset and preserves original src as fallback', () => {
  const src = 'https://atrani.ru/blog/content/images/2026/05/newnewnew.jpg';
  const srcset = buildGhostSrcSet(src, [80, 480, 720, 1000, 1400]);

  assert.equal(
    srcset,
    [
      'https://atrani.ru/blog/content/images/size/w160/2026/05/newnewnew.jpg 160w',
      'https://atrani.ru/blog/content/images/size/w600/2026/05/newnewnew.jpg 600w',
      'https://atrani.ru/blog/content/images/size/w960/2026/05/newnewnew.jpg 960w',
      'https://atrani.ru/blog/content/images/size/w1000/2026/05/newnewnew.jpg 1000w',
      'https://atrani.ru/blog/content/images/size/w1600/2026/05/newnewnew.jpg 1600w',
    ].join(', '),
  );
});

test('returns null for non-Ghost image size requests', () => {
  assert.equal(buildGhostSizeUrl('https://atrani.ru/images/index/imagehero.webp', 960), null);
  assert.equal(buildGhostSrcSet('https://example.com/image.jpg', [600, 1000]), null);
});

test('calculates responsive width candidates up to intrinsic and retina caps', () => {
  assert.deepEqual(getResponsiveWidths(950), [640, 960, 1280, 1600, 1900]);
  assert.deepEqual(getResponsiveWidths(3000), [640, 960, 1280, 1600, 1920, 2560]);
});

test('builds Cloudinary fetch URLs and srcsets from relative sources', () => {
  assert.equal(
    buildCloudinaryFetchUrl({
      src: '/images/index/excursion-boat.webp',
      width: 960,
      cloudName: 'di63rbpo7',
    }),
    'https://res.cloudinary.com/di63rbpo7/image/fetch/f_auto,q_auto,w_960/https://atrani.ru/images/index/excursion-boat.webp',
  );

  assert.equal(
    buildCloudinarySrcSet({
      src: '/images/index/excursion-boat.webp',
      widths: [640, 960],
      cloudName: 'di63rbpo7',
    }),
    [
      'https://res.cloudinary.com/di63rbpo7/image/fetch/f_auto,q_auto,w_640/https://atrani.ru/images/index/excursion-boat.webp 640w',
      'https://res.cloudinary.com/di63rbpo7/image/fetch/f_auto,q_auto,w_960/https://atrani.ru/images/index/excursion-boat.webp 960w',
    ].join(', '),
  );
});
