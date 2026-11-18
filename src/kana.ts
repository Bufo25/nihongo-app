// Данные и логика тренажёра каны. Чтение — по Поливанову (кириллица) и по Хэпбёрну (латиница).
import type { KanaStat } from './logic.ts';

export interface KanaRow {
  id: string;
  title: string;
  group: 'basic' | 'dakuten' | 'yoon';
  /** [хирагана, Поливанов, варианты латиницей…] */
  chars: [string, string, ...string[]][];
}

// Ответы: первый вариант — основной для показа, остальные тоже принимаются.
export const ROWS: KanaRow[] = [
  { id: 'a', title: 'あ', group: 'basic', chars: [['あ', 'а', 'a'], ['い', 'и', 'i'], ['う', 'у', 'u'], ['え', 'э', 'e'], ['お', 'о', 'o']] },
  { id: 'ka', title: 'か', group: 'basic', chars: [['か', 'ка', 'ka'], ['き', 'ки', 'ki'], ['く', 'ку', 'ku'], ['け', 'кэ', 'ke'], ['こ', 'ко', 'ko']] },
  { id: 'sa', title: 'さ', group: 'basic', chars: [['さ', 'са', 'sa'], ['し', 'си', 'shi', 'si'], ['す', 'су', 'su'], ['せ', 'сэ', 'se'], ['そ', 'со', 'so']] },
  { id: 'ta', title: 'た', group: 'basic', chars: [['た', 'та', 'ta'], ['ち', 'ти', 'chi', 'ti'], ['つ', 'цу', 'tsu', 'tu'], ['て', 'тэ', 'te'], ['と', 'то', 'to']] },
  { id: 'na', title: 'な', group: 'basic', chars: [['な', 'на', 'na'], ['に', 'ни', 'ni'], ['ぬ', 'ну', 'nu'], ['ね', 'нэ', 'ne'], ['の', 'но', 'no']] },
  { id: 'ha', title: 'は', group: 'basic', chars: [['は', 'ха', 'ha'], ['ひ', 'хи', 'hi'], ['ふ', 'фу', 'fu', 'hu'], ['へ', 'хэ', 'he'], ['ほ', 'хо', 'ho']] },
  { id: 'ma', title: 'ま', group: 'basic', chars: [['ま', 'ма', 'ma'], ['み', 'ми', 'mi'], ['む', 'му', 'mu'], ['め', 'мэ', 'me'], ['も', 'мо', 'mo']] },
  { id: 'ya', title: 'や', group: 'basic', chars: [['や', 'я', 'ya'], ['ゆ', 'ю', 'yu'], ['よ', 'ё', 'yo']] },
  { id: 'ra', title: 'ら', group: 'basic', chars: [['ら', 'ра', 'ra'], ['り', 'ри', 'ri'], ['る', 'ру', 'ru'], ['れ', 'рэ', 're'], ['ろ', 'ро', 'ro']] },
  { id: 'wa', title: 'わ', group: 'basic', chars: [['わ', 'ва', 'wa'], ['を', 'о', 'wo', 'o'], ['ん', 'н', 'n', 'nn']] },
  { id: 'ga', title: 'が', group: 'dakuten', chars: [['が', 'га', 'ga'], ['ぎ', 'ги', 'gi'], ['ぐ', 'гу', 'gu'], ['げ', 'гэ', 'ge'], ['ご', 'го', 'go']] },
  { id: 'za', title: 'ざ', group: 'dakuten', chars: [['ざ', 'дза', 'za'], ['じ', 'дзи', 'ji', 'zi'], ['ず', 'дзу', 'zu'], ['ぜ', 'дзэ', 'ze'], ['ぞ', 'дзо', 'zo']] },
  { id: 'da', title: 'だ', group: 'dakuten', chars: [['だ', 'да', 'da'], ['ぢ', 'дзи', 'ji', 'di'], ['づ', 'дзу', 'zu', 'du'], ['で', 'дэ', 'de'], ['ど', 'до', 'do']] },
  { id: 'ba', title: 'ば', group: 'dakuten', chars: [['ば', 'ба', 'ba'], ['び', 'би', 'bi'], ['ぶ', 'бу', 'bu'], ['べ', 'бэ', 'be'], ['ぼ', 'бо', 'bo']] },
  { id: 'pa', title: 'ぱ', group: 'dakuten', chars: [['ぱ', 'па', 'pa'], ['ぴ', 'пи', 'pi'], ['ぷ', 'пу', 'pu'], ['ぺ', 'пэ', 'pe'], ['ぽ', 'по', 'po']] },
  { id: 'kya', title: 'きゃ', group: 'yoon', chars: [['きゃ', 'кя', 'kya'], ['きゅ', 'кю', 'kyu'], ['きょ', 'кё', 'kyo']] },
  { id: 'sha', title: 'しゃ', group: 'yoon', chars: [['しゃ', 'ся', 'sha', 'sya'], ['しゅ', 'сю', 'shu', 'syu'], ['しょ', 'сё', 'sho', 'syo']] },
  { id: 'cha', title: 'ちゃ', group: 'yoon', chars: [['ちゃ', 'тя', 'cha', 'tya'], ['ちゅ', 'тю', 'chu', 'tyu'], ['ちょ', 'тё', 'cho', 'tyo']] },
  { id: 'nya', title: 'にゃ', group: 'yoon', chars: [['にゃ', 'ня', 'nya'], ['にゅ', 'ню', 'nyu'], ['にょ', 'нё', 'nyo']] },
  { id: 'hya', title: 'ひゃ', group: 'yoon', chars: [['ひゃ', 'хя', 'hya'], ['ひゅ', 'хю', 'hyu'], ['ひょ', 'хё', 'hyo']] },
  { id: 'mya', title: 'みゃ', group: 'yoon', chars: [['みゃ', 'мя', 'mya'], ['みゅ', 'мю', 'myu'], ['みょ', 'мё', 'myo']] },
  { id: 'rya', title: 'りゃ', group: 'yoon', chars: [['りゃ', 'ря', 'rya'], ['りゅ', 'рю', 'ryu'], ['りょ', 'рё', 'ryo']] },
  { id: 'gya', title: 'ぎゃ', group: 'yoon', chars: [['ぎゃ', 'гя', 'gya'], ['ぎゅ', 'гю', 'gyu'], ['ぎょ', 'гё', 'gyo']] },
  { id: 'ja', title: 'じゃ', group: 'yoon', chars: [['じゃ', 'дзя', 'ja', 'jya', 'zya'], ['じゅ', 'дзю', 'ju', 'jyu', 'zyu'], ['じょ', 'дзё', 'jo', 'jyo', 'zyo']] },
  { id: 'bya', title: 'びゃ', group: 'yoon', chars: [['びゃ', 'бя', 'bya'], ['びゅ', 'бю', 'byu'], ['びょ', 'бё', 'byo']] },
  { id: 'pya', title: 'ぴゃ', group: 'yoon', chars: [['ぴゃ', 'пя', 'pya'], ['ぴゅ', 'пю', 'pyu'], ['ぴょ', 'пё', 'pyo']] },
];

export type Script = 'hira' | 'kata';
export type Reading = 'cyr' | 'lat';

export interface KanaItem {
  key: string; // ключ статистики: сам знак (хирагана или катакана)
  kana: string;
  cyr: string;
  lat: string;
  accept: string[];
  row: string;
}

/** Хирагана → катакана: сдвиг кодовой точки на 0x60. */
export function toKata(s: string): string {
  return [...s].map((c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).join('');
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, '');
}

export function itemsFor(script: Script, rowIds: string[]): KanaItem[] {
  return ROWS.filter((r) => rowIds.includes(r.id)).flatMap((r) =>
    r.chars.map(([h, cyr, ...lat]) => {
      const kana = script === 'hira' ? h : toKata(h);
      const accept = [cyr, ...lat];
      // «е» вместо «ё» и «э» вместо «е» не считаем ошибкой
      if (cyr.includes('э')) accept.push(cyr.replace('э', 'е'));
      return { key: kana, kana, cyr, lat: lat[0], accept: [...new Set(accept.map(norm))], row: r.id };
    }),
  );
}

export function allItems(script: Script): KanaItem[] {
  return itemsFor(
    script,
    ROWS.map((r) => r.id),
  );
}

export function isCorrect(item: KanaItem, answer: string): boolean {
  return item.accept.includes(norm(answer));
}

export const MAX_BOX = 5;
export const MASTERED = 4;

/** Следующий знак: чем хуже знаю, тем чаще. Не повторяем только что показанный. */
export function pickNext<T extends { key: string }>(items: T[], stats: Record<string, KanaStat>, lastKey?: string, rnd = Math.random): T {
  const pool = items.length > 1 ? items.filter((i) => i.key !== lastKey) : items;
  const weights = pool.map((i) => {
    const box = stats[i.key]?.box ?? 0;
    return (MAX_BOX + 1 - box) ** 2;
  });
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function applyAnswer(stat: KanaStat | undefined, ok: boolean): KanaStat {
  const s = stat ?? { box: 0, ok: 0, bad: 0 };
  return ok ? { box: Math.min(MAX_BOX, s.box + 1), ok: s.ok + 1, bad: s.bad } : { box: 0, ok: s.ok, bad: s.bad + 1 };
}

/** 4 варианта ответа: правильный + 3 других с отличающимся чтением, по возможности из того же набора. */
export function choicesFor(item: KanaItem, pool: KanaItem[], reading: Reading, rnd = Math.random): string[] {
  const label = (i: KanaItem) => (reading === 'cyr' ? i.cyr : i.lat);
  const right = label(item);
  const others = [...new Set(pool.map(label).filter((l) => l !== right))];
  const extra = [...new Set(allItems('hira').map(label).filter((l) => l !== right && !others.includes(l)))];
  const src = others.length >= 3 ? others : [...others, ...extra];
  const picked: string[] = [];
  const copy = [...src];
  while (picked.length < 3 && copy.length) picked.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  const all = [right, ...picked];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** 4 знака на выбор: правильный + 3 с другим чтением (じ и ぢ звучат одинаково — вместе не показываем). */
export function kanaChoicesFor(item: KanaItem, pool: KanaItem[], script: Script, rnd = Math.random): string[] {
  const others = pool.filter((i) => i.cyr !== item.cyr);
  const extra = allItems(script).filter((i) => i.cyr !== item.cyr && !others.some((o) => o.key === i.key));
  const src = others.length >= 3 ? others : [...others, ...extra];
  const picked: string[] = [];
  const copy = [...src];
  while (picked.length < 3 && copy.length) {
    const c = copy.splice(Math.floor(rnd() * copy.length), 1)[0];
    if (!picked.some((p) => itemByKana(src, p)?.cyr === c.cyr)) picked.push(c.kana);
  }
  const all = [item.kana, ...picked];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

function itemByKana(pool: KanaItem[], kana: string) {
  return pool.find((i) => i.kana === kana);
}

/** Знаки, которые на слух не отличить от других: ぢ=じ, づ=ず, を=お. */
export const SAME_SOUND = new Set(['ぢ', 'づ', 'を', 'ヂ', 'ヅ', 'ヲ']);
