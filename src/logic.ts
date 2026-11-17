// Чистая логика: даты, недели плана, статусы дней, серия. Без DOM.
import { BLOCKS, type BlockId } from './plan.ts';

export interface DayRec {
  done: Partial<Record<BlockId, true>>;
  bad?: true;
}

export interface Review {
  good: string;
  missed: string;
  change: string;
  savedAt: string;
}

export interface State {
  v: 1;
  startDate: string | null; // первый день недели 1
  weekLengths: number[]; // длина каждой из 12 недель в днях (продление = +7)
  days: Record<string, DayRec>;
  tasks: Record<string, true>; // задачи недель: "w3t1"
  checkpoints: Record<string, true>; // "m1c0"
  reviews: Record<string, Review>; // ключ — понедельник календарной недели
  diary: Record<string, string>;
  reminder: { enabled: boolean; time: string };
}

export function emptyState(): State {
  return {
    v: 1,
    startDate: null,
    weekLengths: Array(12).fill(7),
    days: {},
    tasks: {},
    checkpoints: {},
    reviews: {},
    diary: {},
    reminder: { enabled: false, time: '20:00' },
  };
}

// ---------- даты (ключи вида YYYY-MM-DD, локальное время) ----------

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Сколько дней от a до b (b − a). Через UTC, чтобы переход на летнее время не мешал. */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** 0 = понедельник … 6 = воскресенье */
export function weekday(k: string): number {
  return (parseKey(k).getDay() + 6) % 7;
}

export function mondayOf(k: string): string {
  return addDays(k, -weekday(k));
}

export function isWeekend(k: string): boolean {
  return weekday(k) >= 5;
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

export function fmtDay(k: string, withWeekday = false): string {
  const d = parseKey(k);
  const s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  return withWeekday ? `${WEEKDAYS[weekday(k)]}, ${s}` : s;
}

export function fmtRange(a: string, b: string): string {
  const da = parseKey(a);
  const db = parseKey(b);
  if (da.getMonth() === db.getMonth()) return `${da.getDate()}–${db.getDate()} ${MONTHS_GEN[db.getMonth()]}`;
  return `${fmtDay(a)} – ${fmtDay(b)}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ---------- недели плана ----------

/** Номер недели плана для дня: 0 — до старта, 1..12, 13 — план закончен. */
export function planWeekOf(s: State, k: string): number {
  if (!s.startDate) return 1;
  let off = diffDays(s.startDate, k);
  if (off < 0) return 0;
  for (let i = 0; i < 12; i++) {
    if (off < s.weekLengths[i]) return i + 1;
    off -= s.weekLengths[i];
  }
  return 13;
}

/** Неделя для правил (1..12). */
export function ruleWeek(s: State, k: string): number {
  return Math.min(Math.max(planWeekOf(s, k), 1), 12);
}

export function monthOfWeek(w: number): number {
  return Math.min(Math.ceil(w / 4), 3);
}

export function weekRange(s: State, n: number): { start: string; end: string } | null {
  if (!s.startDate) return null;
  let start = s.startDate;
  for (let i = 0; i < n - 1; i++) start = addDays(start, s.weekLengths[i]);
  return { start, end: addDays(start, s.weekLengths[n - 1] - 1) };
}

/** Можно ли отменить продление недели n, не «уехав» в прошлое. */
export function canShrink(s: State, n: number, today: string): boolean {
  const r = weekRange(s, n);
  if (!r || s.weekLengths[n - 1] <= 7) return false;
  return diffDays(today, addDays(r.end, -7)) >= 0;
}

// ---------- блоки и статусы дней ----------

export function activeBlocks(week: number) {
  return BLOCKS.filter((b) => week >= b.from && (b.until === undefined || week <= b.until));
}

export function dailyBlocks(week: number): BlockId[] {
  return activeBlocks(week).filter((b) => b.freq === 'daily').map((b) => b.id);
}

export type DayStatus = 'full' | 'light' | 'none';

export function dayStatus(s: State, k: string): DayStatus {
  const rec = s.days[k];
  if (!rec) return 'none';
  const req = dailyBlocks(ruleWeek(s, k));
  if (req.length > 0 && req.every((id) => rec.done[id])) return 'full';
  if (rec.bad || Object.keys(rec.done).length > 0) return 'light';
  return 'none';
}

/** Сколько раз блок сделан в календарной неделе, где лежит день k (по k включительно — нет, вся неделя). */
export function countInWeek(s: State, id: BlockId, k: string): number {
  const mon = mondayOf(k);
  let n = 0;
  for (let i = 0; i < 7; i++) if (s.days[addDays(mon, i)]?.done[id]) n++;
  return n;
}

export type Mark = 'full' | 'light-ok' | 'light-broke' | 'none';

export interface StreakInfo {
  current: number;
  best: number;
  total: number; // всего засчитанных дней
  marks: Record<string, Mark>;
}

/**
 * Серия: дни подряд, где сделана вся обязательная часть.
 * Один лёгкий день (кнопка «плохой день» или сделано не всё) в календарную неделю
 * засчитывается и не рвёт серию; второй лёгкий день в ту же неделю — рвёт.
 * Пустой день рвёт серию. Сегодня, пока ничего не отмечено, серию не рвёт.
 */
export function computeStreak(s: State, today: string): StreakInfo {
  const keys = Object.keys(s.days).filter((k) => k <= today).sort();
  const marks: Record<string, Mark> = {};
  if (keys.length === 0) return { current: 0, best: 0, total: 0, marks };
  const lightUsed = new Set<string>();
  let cur = 0;
  let best = 0;
  let total = 0;
  for (let k = keys[0]; k <= today; k = addDays(k, 1)) {
    const st = dayStatus(s, k);
    if (st === 'full') {
      cur++;
      total++;
      marks[k] = 'full';
    } else if (st === 'light') {
      const wk = mondayOf(k);
      if (lightUsed.has(wk) && k === today) {
        // сегодня ещё не закончилось: незаконченный день серию не рвёт
        marks[k] = 'none';
      } else if (lightUsed.has(wk)) {
        cur = 0;
        marks[k] = 'light-broke';
      } else {
        lightUsed.add(wk);
        cur++;
        total++;
        marks[k] = 'light-ok';
      }
    } else {
      marks[k] = 'none';
      if (k !== today) cur = 0;
    }
    best = Math.max(best, cur);
  }
  return { current: cur, best, total, marks };
}

/** Сколько полных дней подряд перед сегодня ничего не отмечено (null — истории нет). */
export function gapBeforeToday(s: State, today: string): number | null {
  const last = Object.keys(s.days)
    .filter((k) => k < today && dayStatus(s, k) !== 'none')
    .sort()
    .pop();
  if (!last) return null;
  return diffDays(last, today) - 1;
}

export function lastActiveDay(s: State): string | null {
  return (
    Object.keys(s.days)
      .filter((k) => dayStatus(s, k) !== 'none')
      .sort()
      .pop() ?? null
  );
}
