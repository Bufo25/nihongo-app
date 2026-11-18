// Слияние данных двух устройств. Каждый элемент (день, запись дневника, урок, знак каны…)
// имеет время последнего изменения в state.mtime; при слиянии побеждает более свежий.
// Удаление тоже изменение: время остаётся в mtime, а значения нет.
import type { State } from './logic.ts';

/** Коллекции, которые синхронизируются поэлементно. */
const COLLECTIONS = ['days', 'tasks', 'checkpoints', 'reviews', 'diary', 'lessons', 'words', 'kana', 'kanaLog', 'minutes'] as const;
/** Одиночные поля, которые синхронизируются целиком. */
const FIELDS = ['startDate', 'weekLengths'] as const;

type Flat = Record<string, string>;

export function flatten(s: State): Flat {
  const out: Flat = {};
  for (const f of FIELDS) if (s[f] !== null && s[f] !== undefined) out[f] = JSON.stringify(s[f]);
  for (const c of COLLECTIONS) {
    const coll = (s[c] ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(coll)) out[`${c}/${k}`] = JSON.stringify(coll[k]);
  }
  return out;
}

function setPath(s: State, path: string, json: string | undefined) {
  const i = path.indexOf('/');
  if (i < 0) {
    const f = path as (typeof FIELDS)[number];
    if (json === undefined) {
      if (f === 'startDate') s.startDate = null;
      else s.weekLengths = Array(12).fill(7);
    } else (s as unknown as Record<string, unknown>)[f] = JSON.parse(json);
    return;
  }
  const c = path.slice(0, i) as (typeof COLLECTIONS)[number];
  const k = path.slice(i + 1);
  const coll = ((s as unknown as Record<string, Record<string, unknown>>)[c] ??= {});
  if (json === undefined) delete coll[k];
  else coll[k] = JSON.parse(json);
}

/** Отметить время изменения у всего, что отличается между before и after. */
export function stampChanges(before: State, after: State, now = Date.now()): void {
  const a = flatten(before);
  const b = flatten(after);
  after.mtime ??= {};
  for (const p of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[p] !== b[p]) after.mtime[p] = now;
  }
}

/** Слить remote в local. Возвращает новое состояние и сколько элементов пришло с другой стороны. */
export function merge(local: State, remote: State): { state: State; fromRemote: number; fromLocal: number } {
  const out = structuredClone(local);
  out.mtime ??= {};
  const lf = flatten(local);
  const rf = flatten(remote);
  const lm = local.mtime ?? {};
  const rm = remote.mtime ?? {};
  const paths = new Set([...Object.keys(lf), ...Object.keys(rf), ...Object.keys(lm), ...Object.keys(rm)]);
  let fromRemote = 0;
  let fromLocal = 0;
  for (const p of paths) {
    const lt = lm[p] ?? 0;
    const rt = rm[p] ?? 0;
    if (lf[p] === rf[p]) {
      if (rt > lt) out.mtime[p] = rt;
      continue;
    }
    // побеждает более свежее изменение; при равенстве (старые данные без времени) — то, что есть
    const takeRemote = rt > lt || (rt === lt && lf[p] === undefined);
    if (takeRemote) {
      setPath(out, p, rf[p]);
      if (rt) out.mtime[p] = rt;
      fromRemote++;
    } else {
      fromLocal++;
    }
  }
  return { state: out, fromRemote, fromLocal };
}

/** Только синхронизируемая часть состояния — то, что кладём в файл на Google Drive. */
export function syncPayload(s: State): Partial<State> {
  const { reminder: _r, ...rest } = s;
  return rest;
}
