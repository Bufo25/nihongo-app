import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isKana, readingOf, toCyrillic, toLatin } from '../src/transcribe.ts';

const cases: [string, string, string][] = [
  ['せんぱい', 'сэмпай', 'senpai'],
  ['がっこう', 'гакко:', 'gakkō'],
  ['コーヒー', 'ко:хи:', 'kōhī'],
  ['インヘル', 'инхэру', 'inheru'],
  ['ねこ', 'нэко', 'neko'],
  ['しんぶん', 'симбун', 'shinbun'],
  ['きょう', 'кё:', 'kyō'],
  ['かいしゃ', 'кайся', 'kaisha'],
  ['せんせい', 'сэнсэй', 'sensei'],
  ['ちょっと', 'тётто', 'chotto'],
  ['まっちゃ', 'маття', 'matcha'],
  ['ゆうき', 'ю:ки', 'yūki'],
  ['おはよう', 'охаё:', 'ohayō'],
  ['パーティー', 'па:ти:', 'pātī'],
  ['ファイル', 'файру', 'fairu'],
  ['ほんや', 'хоня', "hon'ya"],
  ['いい', 'ии', 'ii'],
  ['フブキ', 'фубуки', 'fubuki'],
  ['かわいい', 'каваии', 'kawaii'],
];

test('транскрипция каны', () => {
  for (const [k, cyr, lat] of cases) {
    assert.equal(toCyrillic(k), cyr, k);
    assert.equal(toLatin(k), lat, k);
  }
});

test('не кана — нет транскрипции', () => {
  assert.equal(toCyrillic('先輩'), null);
  assert.equal(toLatin('abc'), null);
  assert.ok(isKana('インヘル') && isKana('ねこ') && !isKana('猫'));
});

test('чтение формы в тексте по словарной', () => {
  assert.equal(readingOf('食べ', '食べる', 'たべる'), 'たべ');
  assert.equal(readingOf('食べました', '食べる', 'たべる'), 'たべました');
  assert.equal(readingOf('先輩', '先輩', 'せんぱい'), 'せんぱい');
  assert.equal(readingOf('行った', '行く', 'いく'), 'いった');
  assert.equal(readingOf('勉強', '勉強', 'べんきょう'), 'べんきょう');
  assert.equal(readingOf('ねこ', '猫', 'ねこ'), 'ねこ');
  assert.equal(readingOf('猫', '犬', 'いぬ'), null);
});
