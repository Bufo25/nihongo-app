import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fmtTime, lineAt, parseAny, parseTime, startFrom, tokenize, videoIdFrom, wordsTsv } from '../src/reader.ts';

test('id видео из разных ссылок', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=90s&list=x`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `youtu.be/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube.com/embed/${id}`,
    id,
  ]) assert.equal(videoIdFrom(u), id, u);
  assert.equal(videoIdFrom('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoIdFrom('просто текст'), null);
  assert.equal(startFrom(`https://youtu.be/${id}?t=95`), 95);
  assert.equal(startFrom(`https://youtube.com/watch?v=${id}&t=1m30s`), 90);
});

test('время', () => {
  assert.equal(parseTime('2:03'), 123);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('00:00:01,500'), 1.5);
  assert.equal(parseTime('0:00:01.50'), 1.5);
  assert.equal(parseTime('abc'), null);
  assert.equal(fmtTime(3723), '1:02:03');
  assert.equal(fmtTime(65), '1:05');
});

test('расшифровка, скопированная с YouTube (время отдельной строкой)', () => {
  const src = `0:00
こんにちは、みなさん。
0:03
きょうは
いい てんきですね。
1:05:07
さようなら`;
  assert.deepEqual(parseAny(src), [
    { t: 0, text: 'こんにちは、みなさん。' },
    { t: 3, text: 'きょうは いい てんきですね。' },
    { t: 3907, text: 'さようなら' },
  ]);
});

test('расшифровка с временем в той же строке и подписями длительности', () => {
  const src = `0:00 はじめまして
2 секунды
0:02 よろしく おねがいします`;
  assert.deepEqual(parseAny(src).map((l) => [l.t, l.text]), [[0, 'はじめまして'], [2, 'よろしく おねがいします']]);
});

test('srt и vtt', () => {
  const srt = `1
00:00:01,000 --> 00:00:03,000
<i>ねこが</i>
います

2
00:00:04,500 --> 00:00:06,000
いぬも`;
  assert.deepEqual(parseAny(srt), [{ t: 1, text: 'ねこが います' }, { t: 4.5, text: 'いぬも' }]);
  const vtt = `WEBVTT

00:00:02.000 --> 00:00:03.000 align:start
<c>やま</c>`;
  assert.deepEqual(parseAny(vtt), [{ t: 2, text: 'やま' }]);
});

test('ass (Jimaku)', () => {
  const ass = `[Script Info]
Title: test
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,{\\an8}おはよう、\\Nチー
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,まえ`;
  assert.deepEqual(parseAny(ass), [{ t: 1, text: 'まえ' }, { t: 5, text: 'おはよう、 チー' }]);
});

test('текст без времени делится на фразы', () => {
  assert.deepEqual(parseAny('ねこです。いぬです！\nそうですか？').map((l) => l.text), ['ねこです。', 'いぬです！', 'そうですか？']);
  assert.ok(parseAny('ねこです。').every((l) => l.t === null));
});

test('текущая фраза по времени', () => {
  const lines = [{ t: 0, text: 'a' }, { t: 3, text: 'b' }, { t: 10, text: 'c' }];
  assert.equal(lineAt(lines, 0), 0);
  assert.equal(lineAt(lines, 2.9), 1); // чуть заранее
  assert.equal(lineAt(lines, 9), 1);
  assert.equal(lineAt(lines, 100), 2);
});

test('японский делится на слова', () => {
  const toks = tokenize('わたしはがくせいです。');
  assert.equal(toks.map((t) => t.text).join(''), 'わたしはがくせいです。');
  assert.ok(toks.filter((t) => t.word).length >= 3, JSON.stringify(toks));
  assert.ok(!toks.find((t) => t.text === '。')!.word);
});

test('выгрузка слов для Anki', () => {
  assert.equal(
    wordsTsv([{ word: '猫', sentence: '猫が\tいる', source: 'Видео', at: '' }]),
    '猫\t猫が いる\tВидео\n',
  );
  assert.equal(
    wordsTsv([{ word: '猫', reading: 'ねこ', meaning: 'кошка; кот', sentence: '猫がいる', source: 'Видео', at: '' }]),
    '猫\tねこ — кошка; кот<br>猫がいる\tВидео\n',
  );
});
