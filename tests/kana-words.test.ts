import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HIRA_WORDS, KATA_WORDS, isWordCorrect, rowsOfWord, syllables, translit, wordItems, wordNorm } from '../src/kana-words.ts';
import { ROWS } from '../src/kana.ts';

const allRows = ROWS.map((r) => r.id);

test('все слова состоят из знаков таблицы', () => {
  for (const [w] of [...HIRA_WORDS, ...KATA_WORDS]) assert.ok(!rowsOfWord(w).includes('?'), w + ' ' + syllables(w).join('|'));
});

test('ручные чтения совпадают с чтением по слогам (проверка данных)', () => {
  for (const [w, , cyr, lat] of [...HIRA_WORDS, ...KATA_WORDS]) {
    assert.equal(wordNorm(cyr), wordNorm(translit(w, 'cyr')), `${w}: ${cyr} vs ${translit(w, 'cyr')}`);
    assert.equal(wordNorm(lat), wordNorm(translit(w, 'lat')), `${w}: ${lat} vs ${translit(w, 'lat')}`);
  }
});

test('принимаются разные записи долгих гласных и «й»', () => {
  const items = wordItems('hira', allRows);
  const get = (w: string) => items.find((i) => i.word === w)!;
  for (const a of ['гакко:', 'гакко', 'гаккоо', 'gakkou', 'gakkō', 'gakko', 'GAKKOU']) assert.ok(isWordCorrect(get('がっこう'), a), a);
  assert.ok(!isWordCorrect(get('がっこう'), 'гако'), 'без удвоения — ошибка');
  for (const a of ['сэнсэй', 'сенсей', 'sensei']) assert.ok(isWordCorrect(get('せんせい'), a), a);
  for (const a of ['симбун', 'синбун', 'shinbun', 'shimbun']) assert.ok(isWordCorrect(get('しんぶん'), a), a);
  for (const a of ['маття', 'matcha', 'maccha']) assert.ok(isWordCorrect(get('まっちゃ'), a), a);
  const kata = wordItems('kata', allRows);
  for (const a of ['ко:хи:', 'кохи', 'koohii', 'kōhī']) assert.ok(isWordCorrect(kata.find((i) => i.word === 'コーヒー')!, a), a);
  assert.ok(!isWordCorrect(get('ねこ'), ''));
});

test('слова подбираются по выбранным рядам', () => {
  const w = wordItems('hira', ['a', 'ka', 'na']);
  assert.ok(w.some((i) => i.word === 'ねこ'));
  assert.ok(w.every((i) => rowsOfWord(i.word).every((r) => ['a', 'ka', 'na'].includes(r))));
});
