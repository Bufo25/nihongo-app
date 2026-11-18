import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allItems, applyAnswer, choicesFor, isCorrect, itemsFor, pickNext, toKata } from '../src/kana.ts';

test('катакана из хираганы', () => {
  assert.equal(toKata('しゃ'), 'シャ');
  assert.equal(toKata('ん'), 'ン');
  assert.equal(toKata('を'), 'ヲ');
});

test('набор и ответы', () => {
  assert.equal(allItems('hira').length, 104);
  const shi = itemsFor('hira', ['sa']).find((i) => i.kana === 'し')!;
  for (const a of ['си', 'shi', 'SI', ' Shi ']) assert.ok(isCorrect(shi, a), a);
  assert.ok(!isCorrect(shi, 'са'));
  const kyo = itemsFor('kata', ['kya']).find((i) => i.kana === 'キョ')!;
  assert.ok(isCorrect(kyo, 'кё') && isCorrect(kyo, 'ке') && isCorrect(kyo, 'kyo'));
  const ke = itemsFor('hira', ['ka']).find((i) => i.kana === 'け')!;
  assert.ok(isCorrect(ke, 'кэ') && isCorrect(ke, 'ке'));
});

test('варианты ответа уникальны и содержат правильный', () => {
  const pool = itemsFor('hira', ['za', 'da']);
  for (const it of pool) {
    const c = choicesFor(it, pool, 'cyr');
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(it.cyr));
  }
  const small = itemsFor('hira', ['a']).slice(0, 2);
  assert.equal(choicesFor(small[0], small, 'lat').length, 4);
});

test('слабые знаки выпадают чаще', () => {
  const items = itemsFor('hira', ['a']);
  const stats = Object.fromEntries(items.slice(1).map((i) => [i.key, { box: 5, ok: 5, bad: 0 }]));
  let weak = 0;
  for (let i = 0; i < 1000; i++) if (pickNext(items, stats).key === 'あ') weak++;
  assert.ok(weak > 700, String(weak));
  assert.notEqual(pickNext(items, {}, 'あ', () => 0).key, 'あ');
});

test('коробки Лейтнера', () => {
  let s = applyAnswer(undefined, true);
  s = applyAnswer(s, true);
  assert.equal(s.box, 2);
  s = applyAnswer(s, false);
  assert.deepEqual(s, { box: 0, ok: 2, bad: 1 });
});

import { kanaChoicesFor } from '../src/kana.ts';

test('выбор знака: 4 разных, без одинаково звучащих', () => {
  const pool = itemsFor('hira', ['za', 'da']);
  for (const it of pool) {
    const c = kanaChoicesFor(it, pool, 'hira');
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(it.kana));
    const readings = c.map((k) => pool.concat(itemsFor('hira', ['a', 'ka'])).find((i) => i.kana === k)?.cyr);
    assert.equal(new Set(readings).size, 4, c.join(' '));
  }
});
