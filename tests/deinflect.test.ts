import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deinflect, kindsOfPos, type Kind } from '../src/deinflect.ts';

// мини-словарь: форма → тип
const DICT: Record<string, Kind> = {
  食べる: 'v1', 見る: 'v1', 書く: 'v5', 行く: 'v5', いく: 'v5', 読む: 'v5', 会う: 'v5', 泳ぐ: 'v5', 話す: 'v5', 待つ: 'v5', 死ぬ: 'v5', 遊ぶ: 'v5',
  する: 'vs', 来る: 'vk', くる: 'vk', かわいい: 'adji', 高い: 'adji', 勉強: 'vsn', しまう: 'v5', いる: 'v1',
};

function find(text: string): { base: string; reasons: string[] } | null {
  for (const c of deinflect(text)) {
    const k = DICT[c.text];
    if (k && (c.kind === 'raw' ? c.reasons.length === 0 : c.kind === k)) return { base: c.text, reasons: c.reasons };
  }
  return null;
}

const cases: [string, string, string?][] = [
  ['食べました', '食べる', 'вежливая, прошедшее'],
  ['食べない', '食べる', 'отрицание'],
  ['食べて', '食べる', 'て-форма'],
  ['食べている', '食べる'],
  ['食べています', '食べる'],
  ['食べたい', '食べる', 'желание (〜たい)'],
  ['食べたかった', '食べる'],
  ['食べられる', '食べる'],
  ['食べさせられました', '食べる'],
  ['書きます', '書く'],
  ['書いた', '書く', 'прошедшее'],
  ['書かない', '書く', 'отрицание'],
  ['書ける', '書く', 'возможность'],
  ['書けません', '書く'],
  ['書いてください', '書く'],
  ['書けば', '書く'],
  ['書こう', '書く'],
  ['行った', '行く'],
  ['いって', 'いく'],
  ['読んだ', '読む'],
  ['会って', '会う'],
  ['会わない', '会う'],
  ['泳いで', '泳ぐ'],
  ['話して', '話す'],
  ['待ったら', '待つ'],
  ['死んだ', '死ぬ'],
  ['遊んでいます', '遊ぶ'],
  ['しました', 'する'],
  ['来ます', '来る'],
  ['きた', 'くる'],
  ['こない', 'くる'],
  ['かわいかった', 'かわいい', 'прошедшее'],
  ['高くない', '高い', 'отрицание'],
  ['高くて', '高い'],
  ['勉強しました', '勉強'],
  ['勉強する', '勉強'],
  ['書いてしまった', '書く'],
];

test('формы приводятся к словарной', () => {
  for (const [form, base, reason] of cases) {
    const r = find(form);
    assert.ok(r, `${form}: ничего не найдено`);
    assert.equal(r.base, base, form);
    if (reason) assert.equal(r.reasons.join(', '), reason, form);
  }
});

test('словарная форма — сама себе', () => {
  assert.deepEqual(find('食べる'), { base: '食べる', reasons: [] });
});

test('типы по частям речи JMdict', () => {
  assert.deepEqual([...kindsOfPos(['v5k-s', 'vi'])], ['v5']);
  assert.deepEqual([...kindsOfPos(['n', 'vs'])], ['vsn']);
  assert.deepEqual([...kindsOfPos(['adj-ix'])], ['adji']);
  assert.deepEqual([...kindsOfPos(['vs-i'])], ['vs']);
});

test('цепочки не взрываются', () => {
  assert.ok(deinflect('食べさせられませんでした').length < 400);
});
