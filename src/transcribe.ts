// Транскрипция каны: кириллица по Поливанову и латиница по Хэпбёрну. Работает с любым словом на кане,
// в том числе с заимствованиями на катакане (ファ, ティ, ヴ…) и долгими гласными (ー, おう, えい).

const BASE: Record<string, [string, string]> = {
  あ: ['а', 'a'], い: ['и', 'i'], う: ['у', 'u'], え: ['э', 'e'], お: ['о', 'o'],
  か: ['ка', 'ka'], き: ['ки', 'ki'], く: ['ку', 'ku'], け: ['кэ', 'ke'], こ: ['ко', 'ko'],
  さ: ['са', 'sa'], し: ['си', 'shi'], す: ['су', 'su'], せ: ['сэ', 'se'], そ: ['со', 'so'],
  た: ['та', 'ta'], ち: ['ти', 'chi'], つ: ['цу', 'tsu'], て: ['тэ', 'te'], と: ['то', 'to'],
  な: ['на', 'na'], に: ['ни', 'ni'], ぬ: ['ну', 'nu'], ね: ['нэ', 'ne'], の: ['но', 'no'],
  は: ['ха', 'ha'], ひ: ['хи', 'hi'], ふ: ['фу', 'fu'], へ: ['хэ', 'he'], ほ: ['хо', 'ho'],
  ま: ['ма', 'ma'], み: ['ми', 'mi'], む: ['му', 'mu'], め: ['мэ', 'me'], も: ['мо', 'mo'],
  や: ['я', 'ya'], ゆ: ['ю', 'yu'], よ: ['ё', 'yo'],
  ら: ['ра', 'ra'], り: ['ри', 'ri'], る: ['ру', 'ru'], れ: ['рэ', 're'], ろ: ['ро', 'ro'],
  わ: ['ва', 'wa'], ゐ: ['и', 'i'], ゑ: ['э', 'e'], を: ['о', 'o'], ん: ['н', 'n'],
  が: ['га', 'ga'], ぎ: ['ги', 'gi'], ぐ: ['гу', 'gu'], げ: ['гэ', 'ge'], ご: ['го', 'go'],
  ざ: ['дза', 'za'], じ: ['дзи', 'ji'], ず: ['дзу', 'zu'], ぜ: ['дзэ', 'ze'], ぞ: ['дзо', 'zo'],
  だ: ['да', 'da'], ぢ: ['дзи', 'ji'], づ: ['дзу', 'zu'], で: ['дэ', 'de'], ど: ['до', 'do'],
  ば: ['ба', 'ba'], び: ['би', 'bi'], ぶ: ['бу', 'bu'], べ: ['бэ', 'be'], ぼ: ['бо', 'bo'],
  ぱ: ['па', 'pa'], ぴ: ['пи', 'pi'], ぷ: ['пу', 'pu'], ぺ: ['пэ', 'pe'], ぽ: ['по', 'po'],
  ゔ: ['ву', 'vu'],
  ぁ: ['а', 'a'], ぃ: ['и', 'i'], ぅ: ['у', 'u'], ぇ: ['э', 'e'], ぉ: ['о', 'o'], ゃ: ['я', 'ya'], ゅ: ['ю', 'yu'], ょ: ['ё', 'yo'], ゎ: ['ва', 'wa'],
};

/** Двухбуквенные сочетания: ゃゅょ и маленькие гласные в заимствованиях. */
const PAIRS: Record<string, [string, string]> = {};
const Y: [string, string, string][] = [
  ['き', 'к', 'k'], ['ぎ', 'г', 'g'], ['に', 'н', 'n'], ['ひ', 'х', 'h'], ['び', 'б', 'b'], ['ぴ', 'п', 'p'], ['み', 'м', 'm'], ['り', 'р', 'r'],
];
for (const [k, c, l] of Y) {
  PAIRS[k + 'ゃ'] = [c + 'я', l + 'ya'];
  PAIRS[k + 'ゅ'] = [c + 'ю', l + 'yu'];
  PAIRS[k + 'ょ'] = [c + 'ё', l + 'yo'];
}
Object.assign(PAIRS, {
  しゃ: ['ся', 'sha'], しゅ: ['сю', 'shu'], しょ: ['сё', 'sho'], しぇ: ['сэ', 'she'],
  ちゃ: ['тя', 'cha'], ちゅ: ['тю', 'chu'], ちょ: ['тё', 'cho'], ちぇ: ['тэ', 'che'],
  じゃ: ['дзя', 'ja'], じゅ: ['дзю', 'ju'], じょ: ['дзё', 'jo'], じぇ: ['дзэ', 'je'],
  ぢゃ: ['дзя', 'ja'], ぢゅ: ['дзю', 'ju'], ぢょ: ['дзё', 'jo'],
  ふぁ: ['фа', 'fa'], ふぃ: ['фи', 'fi'], ふぇ: ['фэ', 'fe'], ふぉ: ['фо', 'fo'], ふゅ: ['фю', 'fyu'],
  てぃ: ['ти', 'ti'], でぃ: ['ди', 'di'], とぅ: ['ту', 'tu'], どぅ: ['ду', 'du'], でゅ: ['дю', 'dyu'], てゅ: ['тю', 'tyu'],
  うぃ: ['уи', 'wi'], うぇ: ['уэ', 'we'], うぉ: ['уо', 'wo'],
  ゔぁ: ['ва', 'va'], ゔぃ: ['ви', 'vi'], ゔぇ: ['вэ', 've'], ゔぉ: ['во', 'vo'],
  つぁ: ['ца', 'tsa'], つぃ: ['ци', 'tsi'], つぇ: ['цэ', 'tse'], つぉ: ['цо', 'tso'],
  くぁ: ['ква', 'kwa'], ぐぁ: ['гва', 'gwa'], いぇ: ['йэ', 'ye'],
});

const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Есть ли в строке только кана (с ー). */
export function isKana(s: string): boolean {
  return /^[ぁ-ゖァ-ヺーー]+$/.test(s);
}

interface Syl {
  cyr: string;
  lat: string;
  kana: string;
}

function split(word: string): Syl[] | null {
  const h = toHira(word);
  const out: Syl[] = [];
  for (let i = 0; i < h.length; i++) {
    const two = h.slice(i, i + 2);
    if (PAIRS[two]) {
      out.push({ cyr: PAIRS[two][0], lat: PAIRS[two][1], kana: two });
      i++;
    } else if (h[i] === 'っ' || h[i] === 'ー') out.push({ cyr: h[i], lat: h[i], kana: h[i] });
    else if (BASE[h[i]]) out.push({ cyr: BASE[h[i]][0], lat: BASE[h[i]][1], kana: h[i] });
    else return null; // не кана — не транскрибируем
  }
  return out;
}

const CYR_VOWEL = /[аиуэояюё]$/;
const LAT_MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Кириллица по Поливанову: せんぱい → сэмпай, がっこう → гакко:, コーヒー → ко:хи:. */
export function toCyrillic(word: string): string | null {
  const s = split(word);
  if (!s) return null;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const { cyr, kana } = s[i];
    const next = s[i + 1];
    if (kana === 'っ') {
      if (next && next.cyr !== 'っ' && next.cyr !== 'ー') out += next.cyr[0];
      continue;
    }
    if (kana === 'ー') {
      out += ':';
      continue;
    }
    if (kana === 'ん') {
      out += next && /^[бпм]/.test(next.cyr) ? 'м' : 'н';
      continue;
    }
    const prev = out[out.length - 1] ?? '';
    // долгие: おう/おお → о:, うう → у:, えい → эй, い после гласной → й
    if (kana === 'う' && i > 0 && /[оуёю]$/.test(prev)) {
      out += ':';
      continue;
    }
    // い после гласной — й (かいしゃ → кайся), но не в удвоенном いい (かわいい → каваии)
    if (kana === 'い' && i > 0 && CYR_VOWEL.test(prev) && prev !== 'и' && next?.kana !== 'い') {
      out += 'й';
      continue;
    }
    out += cyr;
  }
  return out;
}

/** Латиница по Хэпбёрну: せんぱい → senpai, がっこう → gakkō, コーヒー → kōhī. */
export function toLatin(word: string): string | null {
  const s = split(word);
  if (!s) return null;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const { lat, kana } = s[i];
    const next = s[i + 1];
    if (kana === 'っ') {
      if (next && next.lat !== 'っ' && next.lat !== 'ー') out += next.lat.startsWith('ch') ? 't' : next.lat[0];
      continue;
    }
    if (kana === 'ー') {
      const v = out[out.length - 1];
      out = LAT_MACRON[v] ? out.slice(0, -1) + LAT_MACRON[v] : out;
      continue;
    }
    if (kana === 'ん') {
      out += next && /^[aiueoy]/.test(next.lat) ? "n'" : 'n';
      continue;
    }
    const v = out[out.length - 1];
    if (kana === 'う' && i > 0 && (v === 'o' || v === 'u')) {
      out = out.slice(0, -1) + LAT_MACRON[v];
      continue;
    }
    out += lat;
  }
  return out;
}

const HAS_KANJI = /\p{Script=Han}/u;
const TAIL_KANA = /[ぁ-ゖ]+$/;

/**
 * Чтение того, что написано в тексте, по словарной форме:
 * surface 食べ (из 食べました), base 食べる, reading たべる → たべ.
 */
export function readingOf(surface: string, base: string, baseReading: string): string | null {
  if (!HAS_KANJI.test(surface)) return toHira(surface);
  if (surface === base) return baseReading;
  const okuri = base.match(TAIL_KANA)?.[0] ?? '';
  if (!baseReading.endsWith(okuri)) return null;
  const stem = base.slice(0, base.length - okuri.length);
  const stemReading = baseReading.slice(0, baseReading.length - okuri.length);
  if (!stem || !surface.startsWith(stem)) return null;
  const rest = surface.slice(stem.length);
  if (HAS_KANJI.test(rest)) return null;
  return stemReading + toHira(rest);
}
