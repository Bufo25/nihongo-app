// Приведение японских форм к словарной: 食べました → 食べる, かわいかった → かわいい, 書いています → 書く.
// Упрощённая версия того, что делает Yomitan: набор правил «окончание → окончание» с проверкой типа слова.

/** Тип слова, к которому приводит правило. raw — промежуточная форма без ограничения. */
export type Kind = 'v1' | 'v5' | 'vs' | 'vk' | 'adji' | 'vsn' | 'raw';

export interface Rule {
  in: string; // окончание в тексте
  out: string; // окончание в словарной форме
  from: Kind[]; // к каким формам применимо (raw — к исходному тексту и промежуточным)
  to: Kind;
  reason: string;
}

export interface Candidate {
  text: string;
  kind: Kind; // raw — исходный текст, подходит любое слово
  reasons: string[]; // цепочка форм от словарной к тексту
}

const U = 'うくぐすつぬぶむる'.split('');
const A = 'わかがさたなばまら'.split(''); // отрицание: かく → かかない, かう → かわない
const I = 'いきぎしちにびみり'.split(''); // основа на -masu
const E = 'えけげせてねべめれ'.split('');
const O = 'おこごそとのぼもろ'.split('');

const rules: Rule[] = [];
const add = (inn: string, out: string, from: Kind[], to: Kind, reason: string) => rules.push({ in: inn, out, from, to, reason });
const RAW: Kind[] = ['raw'];

/** Окончание после основы на -masu. */
const MASU: [string, string][] = [
  ['ます', 'вежливая'],
  ['ました', 'вежливая, прошедшее'],
  ['ません', 'вежливая, отрицание'],
  ['ませんでした', 'вежливая, отрицание, прошедшее'],
  ['ましょう', 'вежливая, «давай»'],
  ['ませんか', 'вежливая, приглашение'],
  ['たい', 'желание (〜たい)'],
  ['たくない', 'желание, отрицание'],
  ['たかった', 'желание, прошедшее'],
  ['たくなかった', 'желание, отрицание, прошедшее'],
  ['ながら', 'одновременно (〜ながら)'],
  ['なさい', 'указание (〜なさい)'],
];
/** Окончание после отрицательной основы. */
const NAI: [string, string][] = [
  ['ない', 'отрицание'],
  ['なかった', 'отрицание, прошедшее'],
  ['なくて', 'отрицание, て-форма'],
  ['ないで', 'без (〜ないで)'],
  ['なければ', 'отрицание, условная'],
];

for (const [end, reason] of MASU) {
  add(end, 'る', RAW, 'v1', reason);
  I.forEach((c, i) => add(c + end, U[i], RAW, 'v5', reason));
  add('し' + end, 'する', RAW, 'vs', reason);
  add('き' + end, 'くる', RAW, 'vk', reason);
}
for (const [end, reason] of NAI) {
  add(end, 'る', RAW, 'v1', reason);
  A.forEach((c, i) => add(c + end, U[i], RAW, 'v5', reason));
  add('し' + end, 'する', RAW, 'vs', reason);
  add('こ' + end, 'くる', RAW, 'vk', reason);
}

// て / た / たら / たり
const TE: [string, string, string][] = [
  ['て', 'で', 'て-форма'],
  ['た', 'だ', 'прошедшее'],
  ['たら', 'だら', 'условная (〜たら)'],
  ['たり', 'だり', 'перечисление (〜たり)'],
];
for (const [t, d, reason] of TE) {
  add(t, 'る', RAW, 'v1', reason);
  add('い' + t, 'く', RAW, 'v5', reason);
  add('い' + d, 'ぐ', RAW, 'v5', reason);
  add('し' + t, 'す', RAW, 'v5', reason);
  for (const u of ['つ', 'る', 'う']) add('っ' + t, u, RAW, 'v5', reason);
  for (const u of ['ぬ', 'ぶ', 'む']) add('ん' + d, u, RAW, 'v5', reason);
  add('いっ' + t, 'いく', RAW, 'v5', reason); // 行く: いって, いった
  add('行っ' + t, '行く', RAW, 'v5', reason);
  add('し' + t, 'する', RAW, 'vs', reason);
  add('き' + t, 'くる', RAW, 'vk', reason);
}

// условная 〜ば и волевая 〜よう
add('れば', 'る', RAW, 'v1', 'условная (〜ば)');
E.forEach((c, i) => add(c + 'ば', U[i], RAW, 'v5', 'условная (〜ば)'));
add('すれば', 'する', RAW, 'vs', 'условная (〜ば)');
add('くれば', 'くる', RAW, 'vk', 'условная (〜ば)');
add('よう', 'る', RAW, 'v1', 'волевая (〜よう)');
O.forEach((c, i) => add(c + 'う', U[i], RAW, 'v5', 'волевая (〜う)'));
add('しよう', 'する', RAW, 'vs', 'волевая (〜よう)');
add('こよう', 'くる', RAW, 'vk', 'волевая (〜よう)');

// производные глаголы (сами спрягаются как v1): возможность, страдательный, побудительный
const DERIV: Kind[] = ['raw', 'v1'];
E.forEach((c, i) => add(c + 'る', U[i], DERIV, 'v5', 'возможность'));
add('られる', 'る', DERIV, 'v1', 'возможность / страдательный');
A.forEach((c, i) => add(c + 'れる', U[i], DERIV, 'v5', 'страдательный'));
A.forEach((c, i) => add(c + 'せる', U[i], DERIV, 'v5', 'побудительный'));
add('させる', 'る', DERIV, 'v1', 'побудительный');
add('させる', 'する', DERIV, 'vs', 'побудительный');
add('される', 'する', DERIV, 'vs', 'страдательный');
add('できる', 'する', DERIV, 'vs', 'возможность');
add('こられる', 'くる', DERIV, 'vk', 'возможность / страдательный');
add('こさせる', 'くる', DERIV, 'vk', 'побудительный');

// て + вспомогательный глагол → て-форма (дальше её разберут правила выше)
const AUX: [string, string][] = [
  ['いる', 'длительная (〜ている)'],
  ['る', 'длительная (〜てる)'],
  ['しまう', 'завершённость (〜てしまう)'],
  ['ください', 'просьба (〜てください)'],
  ['みる', 'попытка (〜てみる)'],
  ['から', 'после (〜てから)'],
  ['も', 'даже если (〜ても)'],
  ['は', '〜ては'],
  ['あげる', 'для кого-то (〜てあげる)'],
  ['もらう', 'получить действие (〜てもらう)'],
  ['くれる', 'для меня (〜てくれる)'],
  ['おく', 'заранее (〜ておく)'],
  ['ある', 'состояние (〜てある)'],
  ['いく', '〜ていく'],
  ['くる', '〜てくる'],
];
const AUXFROM: Kind[] = ['raw', 'v1', 'v5'];
for (const [aux, reason] of AUX) {
  add('て' + aux, 'て', AUXFROM, 'raw', reason);
  add('で' + aux, 'で', AUXFROM, 'raw', reason);
}
add('ちゃう', 'て', AUXFROM, 'raw', 'завершённость (〜ちゃう)');
add('じゃう', 'で', AUXFROM, 'raw', 'завершённость (〜じゃう)');

// い-прилагательные (и 〜たい — тоже прилагательное)
const ADJ: [string, string][] = [
  ['かった', 'прошедшее'],
  ['くない', 'отрицание'],
  ['くなかった', 'отрицание, прошедшее'],
  ['くて', 'て-форма'],
  ['く', 'наречие (〜く)'],
  ['ければ', 'условная (〜ければ)'],
  ['さ', 'существительное (〜さ)'],
  ['そう', 'кажется (〜そう)'],
];
for (const [end, reason] of ADJ) add(end, 'い', RAW, 'adji', reason);

// 来る, записанный иероглифом, спрягается как «る-глагол» по написанию, но тип у него свой (vk)
for (const r of [...rules]) {
  if (r.to === 'v1' && r.out === 'る' && r.from.includes('raw')) add('来' + r.in, '来る', r.from, 'vk', r.reason);
}

// существительное + する: 勉強する → 勉強
add('する', '', ['raw', 'vs'], 'vsn', '〜する');

/** Все возможные словарные формы для текста (включая сам текст). Глубина цепочки — до 4 шагов. */
export function deinflect(text: string): Candidate[] {
  const out: Candidate[] = [{ text, kind: 'raw', reasons: [] }];
  const seen = new Set([`${text}|raw`]);
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (c.reasons.length >= 4) continue;
    for (const r of rules) {
      if (!c.text.endsWith(r.in) || !r.from.includes(c.kind)) continue;
      const base = c.text.slice(0, c.text.length - r.in.length) + r.out;
      if (!base) continue;
      const key = `${base}|${r.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: base, kind: r.to, reasons: [r.reason, ...c.reasons] });
    }
  }
  return out;
}

/** Типы слова по пометкам части речи JMdict (v1, v5k, vs-i, vk, adj-i, vs…). */
export function kindsOfPos(pos: string[]): Set<Kind> {
  const k = new Set<Kind>();
  for (const p of pos) {
    if (p === 'v1' || p === 'v1-s') k.add('v1');
    else if (p.startsWith('v5')) k.add('v5');
    else if (p === 'vs-i' || p === 'vs-s') k.add('vs');
    else if (p === 'vk') k.add('vk');
    else if (p === 'adj-i' || p === 'adj-ix') k.add('adji');
    else if (p === 'vs') k.add('vsn');
  }
  return k;
}

export const RULE_COUNT = rules.length;
