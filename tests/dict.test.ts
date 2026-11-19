import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Dictionary, posRu, type RawEntry } from '../src/dict.ts';

// собираем словарь из образца тем же скриптом, что и в CI
const out = mkdtempSync(join(tmpdir(), 'dict-'));
execFileSync(process.execPath, ['scripts/build-dict.mjs', '--rus', 'tests/fixtures/jmdict-rus-mini.json', '--eng', 'tests/fixtures/jmdict-eng-common-mini.json', '--out', out]);
const index = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(out, index.file), 'utf8')) as { v: string; e: RawEntry[] };
const dict = new Dictionary(data.e, data.v);

test('сборка: русские записи + английские только для частых слов без русского', () => {
  assert.equal(index.rus, 15);
  assert.equal(index.engFallback, 2); // ゲーム и 良い; редкое 稀 не попало
  assert.ok(data.e.every((e) => e[5].length > 0));
  const iku = data.e.find((e) => e[0].includes('行く'))!;
  assert.deepEqual(iku[0], ['行く'], 'редкая форма 逝く скрыта');
});

test('поиск самого длинного слова с начала', () => {
  const r = dict.lookup('ねこは とても かわいいです。')!;
  assert.equal(r.length, 2);
  assert.equal(r.matches[0].entry.kanji[0], '猫');
  assert.match(r.matches[0].entry.senses[0].text, /кошка/);
  assert.equal(dict.lookup('とても かわいい')!.matches[0].entry.senses[0].text, 'очень');
});

test('спряжённые формы находят словарную', () => {
  const tab = dict.lookup('食べましたか')!;
  assert.equal(tab.matches[0].base, '食べる');
  assert.equal(tab.matches[0].reasons.join(', '), 'вежливая, прошедшее');
  assert.equal(tab.length, 5);
  assert.equal(dict.lookup('かわいかった')!.matches[0].entry.kanji[0], '可愛い');
  assert.equal(dict.lookup('勉強しています')!.matches[0].base, '勉強');
  assert.equal(dict.lookup('行きました')!.matches[0].base, '行く');
  assert.equal(dict.lookup('来ません')!.matches[0].base, '来る');
  assert.equal(dict.lookup('いいです')!.matches[0].entry.english, true);
});

test('тип слова проверяется: 見て не превращается в существительное', () => {
  const r = dict.lookup('見て')!;
  assert.equal(r.matches[0].base, '見る');
});

test('ничего не найдено', () => {
  assert.equal(dict.lookup('ぬぬぬ'), null);
  assert.equal(dict.lookup('。'), null);
});

test('части речи по-русски', () => {
  assert.equal(posRu(['v5k-s', 'vi']), 'гл., неперех.');
  assert.equal(posRu(['n', 'vs', 'vt']), 'сущ., +する, перех.');
});
