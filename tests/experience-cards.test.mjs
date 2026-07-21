import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const imagePath = '/images/gastronomy-wine.webp';

test('the supplied wine photo represents the gastronomy tour everywhere', () => {
  const experience = read('src/pages/experience.astro');
  const landing = read('src/pages/tours-gastronomy.astro');

  assert.ok(existsSync(join(root, 'public/images/gastronomy-wine.webp')));
  assert.ok(experience.split(imagePath).length - 1 >= 2, 'card and ItemList schema must use the image');
  assert.match(landing, /image="\/images\/gastronomy-wine\.webp"/);
  assert.match(landing, /imageWidth=\{2000\}/);
  assert.match(landing, /imageHeight=\{2000\}/);
  assert.match(experience, /src="\/images\/cooking-class\.webp" alt="Кулинарный мастер-класс/);
});
