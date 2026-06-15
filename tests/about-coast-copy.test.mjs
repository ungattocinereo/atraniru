import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile('src/components/AboutCoast.astro', 'utf8');
const visibleText = source.replace(/<[^>]*>/g, '');

test('uses the shortened editorial coast copy', () => {
  assert.match(visibleText, /Амальфитанское побережье не объясняют — его видят/);
  assert.match(visibleText, /пейзаж, история и обычная жизнь всё ещё держатся вместе/);
  assert.match(visibleText, /Потом слава ушла\. Атрани остался собой/);
  assert.match(visibleText, /не хочется торопиться, потому что всё нужное уже вокруг/);
});

test('omits longform homepage details', () => {
  assert.doesNotMatch(source, /М\. К\. Эшер/);
  assert.doesNotMatch(source, /церковь Санта Мария Маддалена/);
  assert.doesNotMatch(source, /сколько людей проезжают мимо/);
});
