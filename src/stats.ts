// Расчёты для экрана статистики. Без DOM — проверяются тестами.
import {
  addDays, computeStreak, diffDays, mondayOf, planWeekOf, weekRange, type Mark, type State,
} from './logic.ts';
import { BLOCKS, type BlockId } from './plan.ts';

export interface PlanWeekRow {
  n: number;
  start: string;
  end: string;
  days: number; // сколько дней недели уже прошло (включая сегодня)
  full: number;
  light: number;
  textbook: number;
  shadowing: number;
  minutes: number;
  current: boolean;
}

function minutesOn(s: State, k: string): number {
  return Object.values(s.minutes[k] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

/** Недели плана, которые уже начались. */
export function planWeekRows(s: State, today: string): PlanWeekRow[] {
  if (!s.startDate) return [];
  const cur = Math.min(planWeekOf(s, today), 12);
  const marks = computeStreak(s, today).marks;
  const rows: PlanWeekRow[] = [];
  for (let n = 1; n <= cur; n++) {
    const r = weekRange(s, n)!;
    const row: PlanWeekRow = { n, start: r.start, end: r.end, days: 0, full: 0, light: 0, textbook: 0, shadowing: 0, minutes: 0, current: n === cur };
    for (let k = r.start; k <= r.end && k <= today; k = addDays(k, 1)) {
      row.days++;
      const m = marks[k];
      if (m === 'full') row.full++;
      else if (m === 'light-ok' || m === 'light-broke') row.light++;
      if (s.days[k]?.done.textbook) row.textbook++;
      if (s.days[k]?.done.shadowing) row.shadowing++;
      row.minutes += minutesOn(s, k);
    }
    rows.push(row);
  }
  return rows;
}

export interface CalWeek {
  mon: string;
  minutes: number;
  byBlock: Partial<Record<BlockId, number>>;
  kanaN: number;
  kanaOk: number;
  kanaMs: number;
}

/** Последние count календарных недель (пн–вс), от старой к новой. */
export function calendarWeeks(s: State, today: string, count: number): CalWeek[] {
  const out: CalWeek[] = [];
  const last = mondayOf(today);
  for (let i = count - 1; i >= 0; i--) {
    const mon = addDays(last, -7 * i);
    const w: CalWeek = { mon, minutes: 0, byBlock: {}, kanaN: 0, kanaOk: 0, kanaMs: 0 };
    for (let d = 0; d < 7; d++) {
      const k = addDays(mon, d);
      for (const [b, m] of Object.entries(s.minutes[k] ?? {})) {
        w.byBlock[b as BlockId] = (w.byBlock[b as BlockId] ?? 0) + (m ?? 0);
        w.minutes += m ?? 0;
      }
      const kl = s.kanaLog[k];
      if (kl) {
        w.kanaN += kl.n;
        w.kanaOk += kl.ok;
        w.kanaMs += kl.ms;
      }
    }
    out.push(w);
  }
  return out;
}

export interface HeatDay {
  key: string;
  mark: Mark | 'future' | 'before';
}

/** Карта активности: weeks недель по 7 дней (пн–вс), последняя — текущая. */
export function heatmap(s: State, today: string, weeks: number): HeatDay[][] {
  const marks = computeStreak(s, today).marks;
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const cols: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(first, w * 7 + d);
      const mark = key > today ? 'future' : s.startDate && key < s.startDate && !s.days[key] ? 'before' : (marks[key] ?? 'none');
      col.push({ key, mark });
    }
    cols.push(col);
  }
  return cols;
}

export interface Totals {
  counted: number; // засчитано дней
  full: number;
  sinceStart: number; // дней с начала плана
  minutes: number;
  kanaN: number;
  kanaOk: number;
}

export function totals(s: State, today: string): Totals {
  const st = computeStreak(s, today);
  const full = Object.values(st.marks).filter((m) => m === 'full').length;
  let minutes = 0;
  for (const k of Object.keys(s.minutes)) if (k <= today) minutes += minutesOn(s, k);
  let kanaN = 0;
  let kanaOk = 0;
  for (const v of Object.values(s.kanaLog)) {
    kanaN += v.n;
    kanaOk += v.ok;
  }
  const sinceStart = s.startDate ? Math.max(0, diffDays(s.startDate, today) + 1) : 0;
  return { counted: st.total, full, sinceStart, minutes, kanaN, kanaOk };
}

export interface MonthRow {
  n: number;
  days: number;
  counted: number;
  full: number;
  minutes: number;
  kanaN: number;
  kanaOk: number;
}

/** Итоги по месяцам плана (месяц = 4 недели плана, с учётом продлений). */
export function monthRows(s: State, today: string): MonthRow[] {
  const weeks = planWeekRows(s, today);
  const out: MonthRow[] = [];
  for (let m = 1; m <= 3; m++) {
    const ws = weeks.filter((w) => Math.ceil(w.n / 4) === m);
    if (!ws.length) continue;
    const row: MonthRow = { n: m, days: 0, counted: 0, full: 0, minutes: 0, kanaN: 0, kanaOk: 0 };
    for (const w of ws) {
      row.days += w.days;
      row.full += w.full;
      row.counted += w.full + w.light;
      row.minutes += w.minutes;
      for (let k = w.start; k <= w.end && k <= today; k = addDays(k, 1)) {
        row.kanaN += s.kanaLog[k]?.n ?? 0;
        row.kanaOk += s.kanaLog[k]?.ok ?? 0;
      }
    }
    out.push(row);
  }
  return out;
}

/** Минуты по блокам за всё время — от большего к меньшему. */
export function minutesByBlock(s: State, today: string): { id: BlockId; title: string; minutes: number }[] {
  const acc: Partial<Record<BlockId, number>> = {};
  for (const [k, v] of Object.entries(s.minutes)) {
    if (k > today) continue;
    for (const [b, m] of Object.entries(v)) acc[b as BlockId] = (acc[b as BlockId] ?? 0) + (m ?? 0);
  }
  return BLOCKS.map((b) => ({ id: b.id, title: b.title, minutes: acc[b.id] ?? 0 }))
    .filter((b) => b.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Коротко для плиток и таблиц: «45 мин», «1,5 ч», «23 ч». */
export function fmtHoursShort(min: number): string {
  if (min < 60) return `${min} мин`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${String(h).replace('.', ',')} ч`;
}
