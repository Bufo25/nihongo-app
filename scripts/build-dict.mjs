// Сборка компактного японско-русского словаря для приложения из JMdict в формате jmdict-simplified.
//   node scripts/build-dict.mjs --rus jmdict-rus.json [--eng jmdict-eng-common.json] --out dist/dict
// Русские значения — основные; для частых слов без русского перевода берём английские (помечаются).
// Источник: JMdict (EDRDG), лицензия CC BY-SA 4.0 — https://www.edrdg.org/edrdg/licence.html
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.rus || !args.out) {
  console.error('нужно: --rus <jmdict-rus.json> [--eng <jmdict-eng-common.json>] --out <папка>');
  process.exit(2);
}

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rus = load(args.rus);
const eng = args.eng ? load(args.eng) : { words: [] };

const KINDS = (pos) => {
  const k = new Set();
  for (const p of pos) {
    if (p === 'v1' || p === 'v1-s') k.add('v1');
    else if (p.startsWith('v5')) k.add('v5');
    else if (p === 'vs-i' || p === 'vs-s') k.add('vs');
    else if (p === 'vk') k.add('vk');
    else if (p === 'adj-i' || p === 'adj-ix') k.add('adji');
    else if (p === 'vs') k.add('vsn');
  }
  return k;
};

const HIDE = new Set(['sK', 'sk', 'rK', 'rk', 'ik', 'iK', 'oK', 'ok']); // редкие/устаревшие/только для поиска формы
const forms = (list) => {
  const shown = list.filter((f) => !f.tags?.some((t) => HIDE.has(t)));
  return (shown.length ? shown : list).slice(0, 4).map((f) => f.text);
};
const isCommon = (w) => w.kanji.some((k) => k.common) || w.kana.some((k) => k.common);

function senses(w, lang) {
  return w.sense
    .map((s) => ({ pos: s.partOfSpeech, gl: s.gloss.filter((g) => g.lang === lang).map((g) => g.text) }))
    .filter((s) => s.gl.length)
    .slice(0, 6)
    .map((s) => [s.pos.join(','), s.gl.slice(0, 6).join('; ')]);
}

/** Запись: [иероглифы[], чтения[], типы, частое(1/0), язык('r'|'e'), значения[[части речи, переводы]]] */
const entries = [];
const withRus = new Set();
for (const w of rus.words) {
  const ss = senses(w, 'rus');
  if (!ss.length) continue;
  withRus.add(w.id);
  const kinds = new Set(w.sense.flatMap((s) => [...KINDS(s.partOfSpeech)]));
  entries.push([forms(w.kanji), forms(w.kana), [...kinds].join(','), isCommon(w) ? 1 : 0, 'r', ss]);
}
let engAdded = 0;
for (const w of eng.words) {
  if (withRus.has(w.id) || !isCommon(w)) continue;
  const ss = senses(w, 'eng');
  if (!ss.length) continue;
  const kinds = new Set(w.sense.flatMap((s) => [...KINDS(s.partOfSpeech)]));
  entries.push([forms(w.kanji), forms(w.kana), [...kinds].join(','), 1, 'e', ss]);
  engAdded++;
}

const version = rus.version ?? 'unknown';
const body = JSON.stringify({ v: version, dictDate: rus.dictDate ?? null, e: entries });
const hash = createHash('sha256').update(body).digest('hex').slice(0, 10);
mkdirSync(args.out, { recursive: true });
const file = `jmdict-ru-${hash}.json`;
writeFileSync(join(args.out, file), body);
writeFileSync(
  join(args.out, 'index.json'),
  JSON.stringify({ file, bytes: Buffer.byteLength(body), entries: entries.length, rus: withRus.size, engFallback: engAdded, version, dictDate: rus.dictDate ?? null, built: new Date().toISOString() }),
);
console.log(`словарь: ${entries.length} записей (русских ${withRus.size}, английских для частых слов ${engAdded}), ${(Buffer.byteLength(body) / 1e6).toFixed(1)} МБ → ${join(args.out, file)}`);
