// Короткие слова для тренировки чтения каны. Только знаки из таблицы тренажёра + っ и ー.
// [слово, перевод, чтение по Поливанову, чтение по Хэпбёрну]
import { ROWS, toKata } from './kana.ts';

export type Word = [string, string, string, string];

export const HIRA_WORDS: Word[] = [
  ['ねこ', 'кошка', 'нэко', 'neko'],
  ['いぬ', 'собака', 'ину', 'inu'],
  ['みず', 'вода', 'мидзу', 'mizu'],
  ['やま', 'гора', 'яма', 'yama'],
  ['かわ', 'река', 'кава', 'kawa'],
  ['ひと', 'человек', 'хито', 'hito'],
  ['ほん', 'книга', 'хон', 'hon'],
  ['くるま', 'машина', 'курума', 'kuruma'],
  ['さかな', 'рыба', 'сакана', 'sakana'],
  ['はな', 'цветок', 'хана', 'hana'],
  ['そら', 'небо', 'сора', 'sora'],
  ['あめ', 'дождь', 'амэ', 'ame'],
  ['ゆき', 'снег', 'юки', 'yuki'],
  ['つき', 'луна', 'цуки', 'tsuki'],
  ['ほし', 'звезда', 'хоси', 'hoshi'],
  ['うみ', 'море', 'уми', 'umi'],
  ['いえ', 'дом', 'иэ', 'ie'],
  ['がっこう', 'школа', 'гакко:', 'gakkou'],
  ['せんせい', 'учитель', 'сэнсэй', 'sensei'],
  ['ともだち', 'друг', 'томодати', 'tomodachi'],
  ['でんしゃ', 'электричка', 'дэнся', 'densha'],
  ['きょう', 'сегодня', 'кё:', 'kyou'],
  ['あした', 'завтра', 'асита', 'ashita'],
  ['きのう', 'вчера', 'кино:', 'kinou'],
  ['おちゃ', 'чай', 'отя', 'ocha'],
  ['ごはん', 'рис, еда', 'гохан', 'gohan'],
  ['にほんご', 'японский язык', 'нихонго', 'nihongo'],
  ['ありがとう', 'спасибо', 'аригато:', 'arigatou'],
  ['すし', 'суши', 'суси', 'sushi'],
  ['しゃしん', 'фотография', 'сясин', 'shashin'],
  ['じかん', 'время', 'дзикан', 'jikan'],
  ['かぞく', 'семья', 'кадзоку', 'kazoku'],
  ['おかね', 'деньги', 'оканэ', 'okane'],
  ['みせ', 'магазин', 'мисэ', 'mise'],
  ['えき', 'станция', 'эки', 'eki'],
  ['きって', 'почтовая марка', 'киттэ', 'kitte'],
  ['ざっし', 'журнал', 'дзасси', 'zasshi'],
  ['きっぷ', 'билет', 'киппу', 'kippu'],
  ['とけい', 'часы', 'токэй', 'tokei'],
  ['てがみ', 'письмо', 'тэгами', 'tegami'],
  ['おいしい', 'вкусный', 'оисии', 'oishii'],
  ['たかい', 'высокий, дорогой', 'такай', 'takai'],
  ['やすい', 'дешёвый', 'ясуй', 'yasui'],
  ['あつい', 'жаркий', 'ацуй', 'atsui'],
  ['さむい', 'холодный', 'самуй', 'samui'],
  ['げんき', 'бодрый, здоровый', 'гэнки', 'genki'],
  ['しゅくだい', 'домашнее задание', 'сюкудай', 'shukudai'],
  ['りょこう', 'путешествие', 'рёко:', 'ryokou'],
  ['びょういん', 'больница', 'бё:ин', 'byouin'],
  ['ぎゅうにゅう', 'молоко', 'гю:ню:', 'gyuunyuu'],
  ['おはよう', 'доброе утро', 'охаё:', 'ohayou'],
  ['さようなら', 'до свидания', 'саё:нара', 'sayounara'],
  ['しんぶん', 'газета', 'симбун', 'shinbun'],
  ['てんぷら', 'тэмпура', 'тэмпура', 'tenpura'],
  ['えいが', 'фильм', 'эйга', 'eiga'],
  ['おんがく', 'музыка', 'онгаку', 'ongaku'],
  ['でんわ', 'телефон', 'дэнва', 'denwa'],
  ['へや', 'комната', 'хэя', 'heya'],
  ['つくえ', 'стол', 'цукуэ', 'tsukue'],
  ['まど', 'окно', 'мадо', 'mado'],
  ['くつ', 'обувь', 'куцу', 'kutsu'],
  ['かさ', 'зонт', 'каса', 'kasa'],
  ['かばん', 'сумка', 'кабан', 'kaban'],
  ['ひらがな', 'хирагана', 'хирагана', 'hiragana'],
  ['ちょっと', 'немного', 'тётто', 'chotto'],
  ['きっさてん', 'кафе', 'киссатэн', 'kissaten'],
  ['まっちゃ', 'маття (зелёный чай)', 'маття', 'matcha'],
];

export const KATA_WORDS: Word[] = [
  ['コーヒー', 'кофе', 'ко:хи:', 'koohii'],
  ['ゲーム', 'игра', 'гэ:му', 'geemu'],
  ['アニメ', 'аниме', 'анимэ', 'anime'],
  ['マンガ', 'манга', 'манга', 'manga'],
  ['テレビ', 'телевизор', 'тэрэби', 'terebi'],
  ['カメラ', 'фотоаппарат', 'камэра', 'kamera'],
  ['ホテル', 'отель', 'хотэру', 'hoteru'],
  ['パン', 'хлеб', 'пан', 'pan'],
  ['ノート', 'тетрадь', 'но:то', 'nooto'],
  ['ペン', 'ручка', 'пэн', 'pen'],
  ['バス', 'автобус', 'басу', 'basu'],
  ['タクシー', 'такси', 'такуси:', 'takushii'],
  ['メール', 'электронное письмо', 'мэ:ру', 'meeru'],
  ['ケーキ', 'торт', 'кэ:ки', 'keeki'],
  ['ラーメン', 'рамэн', 'ра:мэн', 'raamen'],
  ['ニュース', 'новости', 'ню:су', 'nyuusu'],
  ['メニュー', 'меню', 'мэню:', 'menyuu'],
  ['コンビニ', 'круглосуточный магазин', 'комбини', 'konbini'],
  ['チーズ', 'сыр', 'ти:дзу', 'chiizu'],
  ['ビール', 'пиво', 'би:ру', 'biiru'],
  ['ドア', 'дверь', 'доа', 'doa'],
  ['トイレ', 'туалет', 'тоирэ', 'toire'],
  ['ボタン', 'кнопка', 'ботан', 'botan'],
  ['サッカー', 'футбол', 'сакка:', 'sakkaa'],
  ['パソコン', 'компьютер', 'пасокон', 'pasokon'],
  ['ロボット', 'робот', 'роботто', 'robotto'],
  ['アイス', 'мороженое', 'айсу', 'aisu'],
  ['スーパー', 'супермаркет', 'су:па:', 'suupaa'],
  ['レストラン', 'ресторан', 'рэсуторан', 'resutoran'],
  ['ギター', 'гитара', 'гита:', 'gitaa'],
  ['ピアノ', 'пианино', 'пиано', 'piano'],
  ['カレー', 'карри', 'карэ:', 'karee'],
  ['サラダ', 'салат', 'сарада', 'sarada'],
  ['ジュース', 'сок', 'дзю:су', 'juusu'],
  ['エレベーター', 'лифт', 'эрэбэ:та:', 'erebeetaa'],
  ['デパート', 'универмаг', 'дэпа:то', 'depaato'],
  ['シャツ', 'рубашка', 'сяцу', 'shatsu'],
  ['ネクタイ', 'галстук', 'нэкутай', 'nekutai'],
  ['キーボード', 'клавиатура', 'ки:бо:до', 'kiiboodo'],
  ['スマホ', 'смартфон', 'сумахо', 'sumaho'],
  ['ホロライブ', 'Hololive', 'хорорайбу', 'hororaibu'],
];

// ---------- разбор слова на слоги ----------

const SMALL = new Set(['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ']);
const toHira = (c: string) => (c >= 'ァ' && c <= 'ヶ' ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c);

/** Слоги: 'き', 'しゃ', 'っ', 'ー'… (в хирагане, даже для слов на катакане). */
export function syllables(word: string): string[] {
  const out: string[] = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] === 'ー' ? 'ー' : toHira(chars[i]);
    if (i + 1 < chars.length && SMALL.has(chars[i + 1])) {
      out.push(c + toHira(chars[i + 1]));
      i++;
    } else out.push(c);
  }
  return out;
}

const SYL: Record<string, { cyr: string; lat: string; row: string }> = {};
for (const r of ROWS) for (const [h, cyr, lat] of r.chars) SYL[h] = { cyr, lat, row: r.id };

/** Из каких рядов таблицы состоит слово. */
export function rowsOfWord(word: string): string[] {
  return [...new Set(syllables(word).filter((s) => s !== 'っ' && s !== 'ー').map((s) => SYL[s]?.row ?? '?'))];
}

const LONG: Record<string, string> = { я: 'а', ю: 'у', ё: 'о' };

/** Чтение слова «по слогам» — для проверки ответа и для тестов данных. */
export function translit(word: string, reading: 'cyr' | 'lat'): string {
  let out = '';
  let double = false;
  for (const s of syllables(word)) {
    if (s === 'っ') {
      double = true;
      continue;
    }
    if (s === 'ー') {
      const last = out[out.length - 1] ?? '';
      out += LONG[last] ?? last;
      continue;
    }
    let r = SYL[s]?.[reading] ?? '?';
    if (double) {
      r = r[0] + r;
      double = false;
    }
    out += r;
  }
  return out;
}

const MACRON: Record<string, string> = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ee', ō: 'oo', â: 'aa', ô: 'oo', û: 'uu' };

/**
 * Нормализация чтения слова: долгие гласные, «й», «ё/е», «м/н» перед б/п/м, апострофы — не важны.
 * Удвоенные согласные (っ) важны: きって ≠ きて.
 */
export function wordNorm(s: string): string {
  let t = s.toLowerCase().trim();
  t = t.replace(/[āīūēōâôû]/g, (c) => MACRON[c]);
  t = t.replace(/[\s'’ʼ\-‐:ːーъ.]/g, '').replace(/й/g, 'и');
  t = t.replace(/tch/g, 'cch');
  // долгие гласные: aa→a, ou→o, ei→e и то же по-русски
  const pairs: [RegExp, string][] = [
    [/яа/g, 'я'], [/юу/g, 'ю'], [/ёо|ёу/g, 'ё'], [/оу/g, 'о'], [/эи/g, 'э'], [/еи/g, 'е'],
    [/аа+/g, 'а'], [/ии+/g, 'и'], [/уу+/g, 'у'], [/ээ+/g, 'э'], [/ее+/g, 'е'], [/оо+/g, 'о'],
    [/ou/g, 'o'], [/ei/g, 'e'], [/aa+/g, 'a'], [/ii+/g, 'i'], [/uu+/g, 'u'], [/ee+/g, 'e'], [/oo+/g, 'o'],
  ];
  for (const [re, to] of pairs) t = t.replace(re, to);
  t = t.replace(/ё/g, 'е').replace(/э/g, 'е');
  t = t.replace(/м(?=[бпм])/g, 'н').replace(/m(?=[bpm])/g, 'n');
  return t;
}

export interface WordItem {
  key: string; // ключ статистики: "w:слово"
  word: string;
  meaning: string;
  cyr: string;
  lat: string;
  accept: string[];
}

export function wordItems(script: 'hira' | 'kata', rows: string[]): WordItem[] {
  const list = script === 'hira' ? HIRA_WORDS : KATA_WORDS;
  return list
    .filter(([w]) => rowsOfWord(w).every((r) => rows.includes(r)))
    .map(([word, meaning, cyr, lat]) => ({
      key: `w:${word}`,
      word,
      meaning,
      cyr,
      lat,
      accept: [...new Set([cyr, lat, translit(word, 'cyr'), translit(word, 'lat')].map(wordNorm))],
    }));
}

export function isWordCorrect(item: WordItem, answer: string): boolean {
  return answer.trim() !== '' && item.accept.includes(wordNorm(answer));
}

export { toKata };
