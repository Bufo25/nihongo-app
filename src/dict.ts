// Японско-русский словарь (JMdict) внутри приложения: загрузка один раз, поиск слова по месту нажатия.
import { useEffect, useState } from 'preact/hooks';
import { deinflect, type Kind } from './deinflect.ts';

/** [иероглифы[], чтения[], типы через запятую, частое 1/0, язык 'r'|'e', значения [[части речи, переводы]]] */
export type RawEntry = [string[], string[], string, 0 | 1, 'r' | 'e', [string, string][]];

export interface Entry {
  kanji: string[];
  kana: string[];
  kinds: Set<Kind>;
  common: boolean;
  english: boolean; // русского перевода нет — показываем английский
  senses: { pos: string[]; text: string }[];
}

export interface Match {
  entry: Entry;
  base: string; // словарная форма, которую нашли
  reasons: string[]; // как из неё получилась форма в тексте
}

export interface LookupResult {
  length: number; // сколько символов текста совпало
  matches: Match[];
}

export class Dictionary {
  private index = new Map<string, number[]>();
  private entries: RawEntry[];
  readonly version: string;
  constructor(entries: RawEntry[], version: string) {
    this.entries = entries;
    this.version = version;
    entries.forEach((e, i) => {
      for (const f of new Set([...e[0], ...e[1]])) {
        const list = this.index.get(f);
        if (list) list.push(i);
        else this.index.set(f, [i]);
      }
    });
  }

  get size() {
    return this.entries.length;
  }

  private entry(i: number): Entry {
    const [kanji, kana, kinds, common, lang, senses] = this.entries[i];
    return {
      kanji,
      kana,
      kinds: new Set(kinds ? (kinds.split(',') as Kind[]) : []),
      common: common === 1,
      english: lang === 'e',
      senses: senses.map(([pos, text]) => ({ pos: pos ? pos.split(',') : [], text })),
    };
  }

  private ids(text: string): number[] {
    return this.index.get(text) ?? this.index.get(kataToHira(text)) ?? [];
  }

  /** Самое длинное слово с начала текста (с учётом спряжения). */
  lookup(text: string, maxLen = 14): LookupResult | null {
    const src = text.slice(0, maxLen).split(/[\s、。！？!?「」『』（）()…・,.:;"'〜~]/u)[0];
    for (let len = src.length; len > 0; len--) {
      const part = src.slice(0, len);
      const found = new Map<number, Match>();
      for (const c of deinflect(part)) {
        // промежуточные формы (например, «…て» после отбрасывания 〜いる) со словарём не сверяем
        if (c.kind === 'raw' && c.reasons.length) continue;
        for (const id of this.ids(c.text)) {
          if (found.has(id)) continue;
          const e = this.entry(id);
          if (c.kind !== 'raw' && !e.kinds.has(c.kind)) continue;
          found.set(id, { entry: e, base: c.text, reasons: c.reasons });
        }
      }
      if (found.size) {
        const matches = [...found.values()].sort(
          (a, b) => Number(b.entry.common) - Number(a.entry.common) || a.reasons.length - b.reasons.length || Number(a.entry.english) - Number(b.entry.english),
        );
        return { length: len, matches: matches.slice(0, 5) };
      }
    }
    return null;
  }
}

export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const POS_RU: Record<string, string> = {
  n: 'сущ.', pn: 'мест.', adv: 'нар.', 'adj-i': 'прил.', 'adj-ix': 'прил.', 'adj-na': 'на-прил.', 'adj-no': 'の-прил.',
  v1: 'гл.', vk: 'гл.', 'vs-i': 'гл.', vs: '+する', vt: 'перех.', vi: 'неперех.', prt: 'частица', exp: 'выражение',
  int: 'межд.', conj: 'союз', ctr: 'счётный суфф.', suf: 'суфф.', pref: 'преф.', num: 'числ.', aux: 'вспом.', 'aux-v': 'вспом. гл.',
};

/** Части речи по-русски (коротко, без повторов). */
export function posRu(pos: string[]): string {
  return [...new Set(pos.map((p) => (p.startsWith('v5') ? 'гл.' : POS_RU[p])).filter(Boolean))].join(', ');
}

// ---------- загрузка ----------

export type DictStatus =
  | { state: 'idle' }
  | { state: 'loading'; loaded: number; total: number }
  | { state: 'ready'; dict: Dictionary }
  | { state: 'missing' }
  | { state: 'error'; message: string };

let status: DictStatus = { state: 'idle' };
const subs = new Set<() => void>();
const set = (s: DictStatus) => {
  status = s;
  subs.forEach((f) => f());
};

export function dictStatus(): DictStatus {
  return status;
}

export function useDict(): DictStatus {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    subs.add(f);
    if (status.state === 'idle') ensureDict();
    return () => {
      subs.delete(f);
    };
  }, []);
  return status;
}

interface DictIndex {
  file: string;
  bytes: number;
  entries: number;
  version: string;
}

let loading: Promise<void> | null = null;

/** Загрузить словарь (один раз). Сам файл кэшируется service worker'ом — второй раз без интернета. */
export function ensureDict(): Promise<void> {
  if (status.state === 'ready') return Promise.resolve();
  loading ??= (async () => {
    try {
      const ir = await fetch('dict/index.json', { cache: 'no-cache' });
      if (ir.status === 404) return set({ state: 'missing' });
      if (!ir.ok) throw new Error(`ошибка ${ir.status}`);
      const idx = (await ir.json()) as DictIndex;
      set({ state: 'loading', loaded: 0, total: idx.bytes });
      const res = await fetch(`dict/${idx.file}`);
      if (!res.ok) throw new Error(`ошибка ${res.status}`);
      const text = await readWithProgress(res, idx.bytes);
      const data = JSON.parse(text) as { v: string; e: RawEntry[] };
      set({ state: 'ready', dict: new Dictionary(data.e, data.v) });
      pruneOld(idx.file);
    } catch (e) {
      set({ state: 'error', message: navigator.onLine ? (e instanceof Error ? e.message : String(e)) : 'нет интернета' });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function readWithProgress(res: Response, total: number): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    set({ state: 'loading', loaded, total: Math.max(total, loaded) });
  }
  const all = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(all);
}

/** Удалить из кэша прошлые версии словаря. */
function pruneOld(current: string) {
  if (!('caches' in window)) return;
  caches
    .open('dict-cache')
    .then(async (c) => {
      for (const req of await c.keys()) if (/jmdict-ru-/.test(req.url) && !req.url.endsWith(current)) await c.delete(req);
    })
    .catch(() => {});
}
