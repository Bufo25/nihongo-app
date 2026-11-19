// Читалка: превращает расшифровку YouTube или файл субтитров в список фраз с временем. Без DOM.

export interface Line {
  t: number | null; // секунда начала фразы (null — время неизвестно)
  text: string;
}

export interface ReaderText {
  id: string;
  title: string;
  videoId: string | null;
  lines: Line[];
  createdAt: string;
}

export interface SavedWord {
  word: string; // словарная форма
  reading?: string; // чтение каной (из словаря)
  meaning?: string; // значение (из словаря)
  sentence: string;
  source: string; // название текста
  at: string;
}

/** ID видео из ссылки YouTube (watch, youtu.be, shorts, live, embed) или null. */
export function videoIdFrom(url: string): string | null {
  const s = url.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Время начала из ссылки (?t=90, ?t=1m30s) — чтобы открыть видео с того же места. */
export function startFrom(url: string): number {
  try {
    const t = new URL(url).searchParams.get('t') ?? '';
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!m) return 0;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } catch {
    return 0;
  }
}

/** «1:02:03» / «2:03» / «00:00:01,500» / «0:00:01.50» → секунды. */
export function parseTime(s: string): number | null {
  const m = s.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const frac = m[4] ? Number(`0.${m[4]}`) : 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac;
}

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, '') // теги vtt/srt: <i>, <c>, <00:00:01.000>
    .replace(/\{[^}]*\}/g, '') // теги ass: {\an8}
    .replace(/\\[Nn]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function parseSrtVtt(src: string): Line[] {
  const out: Line[] = [];
  const blocks = src.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const rows = b.split('\n').filter((r) => r.trim() !== '');
    const i = rows.findIndex((r) => r.includes('-->'));
    if (i < 0) continue;
    const t = parseTime(rows[i].split('-->')[0].trim().split(' ')[0]);
    const text = clean(rows.slice(i + 1).join(' '));
    if (text) out.push({ t, text });
  }
  return out;
}

function parseAss(src: string): Line[] {
  const out: Line[] = [];
  for (const row of src.replace(/\r/g, '').split('\n')) {
    if (!row.startsWith('Dialogue:')) continue;
    // Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text — в тексте могут быть запятые
    const parts = row.slice('Dialogue:'.length).split(',');
    if (parts.length < 10) continue;
    const text = clean(parts.slice(9).join(','));
    if (text) out.push({ t: parseTime(parts[1]), text });
  }
  return out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

const TIME_ONLY = /^\s*(\d{1,2}:)?\d{1,2}:\d{2}\s*$/;
const TIME_LEAD = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+)$/;

/**
 * Расшифровка, скопированная с YouTube: строки времени и текста вперемешку
 * («0:03» отдельной строкой или «0:03 текст»). Без меток — делим по строкам и 。！？.
 */
function parseTranscript(src: string): Line[] {
  const rows = src.replace(/\r/g, '').split('\n').map((r) => r.trim());
  const hasTimes = rows.some((r) => TIME_ONLY.test(r) || TIME_LEAD.test(r));
  const out: Line[] = [];
  if (hasTimes) {
    let t: number | null = null;
    let pending = false; // после метки времени ещё не было текста
    for (const r of rows) {
      if (!r) continue;
      if (TIME_ONLY.test(r)) {
        t = parseTime(r);
        pending = true;
        continue;
      }
      const lead = r.match(TIME_LEAD);
      if (lead) {
        out.push({ t: parseTime(lead[1]), text: clean(lead[2]) });
        pending = false;
        continue;
      }
      const text = clean(r);
      if (!text) continue;
      // строки описания длительности у YouTube («2 секунды», «1 минута, 5 секунд») пропускаем
      if (/^\d+\s+(секунд|минут|час|second|minute|hour)/i.test(text)) continue;
      if (pending || out.length === 0) out.push({ t, text });
      else out[out.length - 1].text += ' ' + text; // перенос строки внутри одной фразы
      pending = false;
    }
    return out.filter((l) => l.text);
  }
  for (const r of rows) {
    if (!r) continue;
    for (const piece of r.split(/(?<=[。！？!?])/)) {
      const text = clean(piece);
      if (text) out.push({ t: null, text });
    }
  }
  return out;
}

/** Любой поддерживаемый формат → фразы. */
export function parseAny(src: string): Line[] {
  const s = src.replace(/^﻿/, '');
  if (/^\s*\[Script Info\]/m.test(s) || /^Dialogue:/m.test(s)) return parseAss(s);
  if (/-->/.test(s)) return parseSrtVtt(s.replace(/^WEBVTT.*$/m, ''));
  return parseTranscript(s);
}

/** Индекс фразы, которая звучит в момент time (последняя с t <= time). */
export function lineAt(lines: Line[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].t;
    if (t === null) continue;
    if (t <= time + 0.15) idx = i;
    else break;
  }
  return idx;
}

export interface Token {
  text: string;
  word: boolean; // можно нажать
}

/** Деление японского на слова — встроенный в браузер Intl.Segmenter (без словаря в приложении). */
export function tokenize(text: string): Token[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
  if (!Seg) return [...text].map((c) => ({ text: c, word: /[\p{L}]/u.test(c) }));
  const out: Token[] = [];
  for (const s of new Seg('ja', { granularity: 'word' }).segment(text)) {
    out.push({ text: s.segment, word: !!s.isWordLike && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}]/u.test(s.segment) });
  }
  return out;
}

export function hasJapanese(s: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
}

/**
 * Слова для импорта в Anki, по строке на слово: «слово<TAB>оборот<TAB>источник».
 * Оборот — чтение и значение (если есть) и фраза через <br> (в Anki — «Разрешить HTML»).
 */
export function wordsTsv(words: SavedWord[]): string {
  const esc = (s: string) => s.replace(/[\t\n\r]+/g, ' ').replace(/</g, '&lt;').trim();
  return (
    words
      .map((w) => {
        const head = [w.reading, w.meaning].filter(Boolean).map((x) => esc(x!)).join(' — ');
        const back = [head, esc(w.sentence)].filter(Boolean).join('<br>');
        return [esc(w.word), back, esc(w.source)].join('\t');
      })
      .join('\n') + '\n'
  );
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Ссылки для перевода слова или фразы на русский. */
export function translateLinks(text: string): { name: string; url: string }[] {
  const q = encodeURIComponent(text);
  return [
    { name: 'Яндекс Переводчик', url: `https://translate.yandex.ru/?source_lang=ja&target_lang=ru&text=${q}` },
    { name: 'Google Переводчик', url: `https://translate.google.com/?sl=ja&tl=ru&text=${q}&op=translate` },
  ];
}
