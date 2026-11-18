import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyState } from '../src/logic.ts';
import { calendarWeeks, fmtHoursShort, fmtMinutes, heatmap, minutesByBlock, monthRows, planWeekRows, totals } from '../src/stats.ts';

function sample() {
  const s = emptyState();
  s.startDate = '2026-11-02'; // пн, неделя 1 — кана
  s.days['2026-11-02'] = { done: { kana: true } };
  s.days['2026-11-03'] = { done: {}, bad: true };
  s.days['2026-11-09'] = { done: { kana: true, anki: true, wagotabi: true } }; // неделя 2, полный
  s.minutes['2026-11-02'] = { kana: 15 };
  s.minutes['2026-11-09'] = { anki: 10, wagotabi: 20 };
  s.kanaLog['2026-11-02'] = { n: 20, ok: 15, ms: 40000 };
  return s;
}

test('недели плана', () => {
  const rows = planWeekRows(sample(), '2026-11-10');
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].full, rows[0].light, rows[0].days, rows[0].minutes], [1, 1, 7, 15]);
  assert.deepEqual([rows[1].full, rows[1].days, rows[1].minutes, rows[1].current], [1, 2, 30, true]);
});

test('календарные недели и итоги', () => {
  const s = sample();
  const w = calendarWeeks(s, '2026-11-10', 3);
  assert.deepEqual(w.map((x) => x.mon), ['2026-10-26', '2026-11-02', '2026-11-09']);
  assert.equal(w[1].kanaN, 20);
  assert.equal(w[2].minutes, 30);
  const t = totals(s, '2026-11-10');
  assert.deepEqual([t.counted, t.full, t.minutes, t.kanaN, t.sinceStart], [3, 2, 45, 20, 9]);
  assert.deepEqual(minutesByBlock(s, '2026-11-10').map((b) => b.id), ['wagotabi', 'kana', 'anki']);
  assert.equal(monthRows(s, '2026-11-10')[0].counted, 3);
});

test('карта активности', () => {
  const h = heatmap(sample(), '2026-11-10', 2);
  assert.equal(h.length, 2);
  assert.equal(h[0][0].key, '2026-11-02');
  assert.equal(h[0][0].mark, 'full');
  assert.equal(h[0][1].mark, 'light-ok');
  assert.equal(h[1][2].mark, 'future');
});

test('минуты словами', () => {
  assert.equal(fmtMinutes(45), '45 мин');
  assert.equal(fmtMinutes(60), '1 ч');
  assert.equal(fmtMinutes(135), '2 ч 15 мин');
});

test('часы коротко', () => {
  assert.equal(fmtHoursShort(45), '45 мин');
  assert.equal(fmtHoursShort(90), '1,5 ч');
  assert.equal(fmtHoursShort(1409), '23,5 ч');
});

import { merge, stampChanges } from '../src/merge.ts';
import type { State } from '../src/logic.ts';

test('занятия в один день на двух устройствах складываются и переживают синхронизацию', () => {
  const base = emptyState();
  base.startDate = '2026-11-02';
  const edit = (s: State, fn: (x: State) => void, t: number) => {
    const n = structuredClone(s);
    fn(n);
    stampChanges(s, n, t);
    return n;
  };
  const pc = edit(base, (x) => {
    x.minutes['2026-11-10@pc'] = { anki: 10 };
    x.kanaLog['2026-11-10@pc'] = { n: 20, ok: 18, ms: 30000 };
  }, 100);
  const phone = edit(base, (x) => {
    x.minutes['2026-11-10@ph'] = { anki: 5, wagotabi: 15 };
    x.kanaLog['2026-11-10@ph'] = { n: 10, ok: 5, ms: 20000 };
  }, 200);
  const both = merge(pc, phone).state;
  // старая запись без устройства тоже учитывается
  both.minutes['2026-11-10'] = { kana: 3 };
  const w = calendarWeeks(both, '2026-11-10', 1)[0];
  assert.deepEqual(w.byBlock, { anki: 15, wagotabi: 15, kana: 3 });
  assert.equal(w.kanaN, 30);
  assert.equal(totals(both, '2026-11-10').minutes, 33);
});
