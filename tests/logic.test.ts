import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyState, computeStreak, planWeekOf, addDays, dayStatus, canShrink, weekRange, diffDays, mondayOf, gapBeforeToday } from '../src/logic.ts';

const full2 = { done: { anki: true as const, wagotabi: true as const } };

test('даты', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2);
  assert.equal(mondayOf('2026-11-22'), '2026-11-16');
  assert.equal(mondayOf('2026-11-16'), '2026-11-16');
});

test('недели и продление', () => {
  const s = emptyState();
  s.startDate = '2026-11-02';
  assert.equal(planWeekOf(s, '2026-11-01'), 0);
  assert.equal(planWeekOf(s, '2026-11-02'), 1);
  assert.equal(planWeekOf(s, '2026-11-09'), 2);
  s.weekLengths[0] = 14;
  assert.equal(planWeekOf(s, '2026-11-09'), 1);
  assert.equal(planWeekOf(s, '2026-11-16'), 2);
  assert.deepEqual(weekRange(s, 2), { start: '2026-11-16', end: '2026-11-22' });
  assert.equal(canShrink(s, 1, '2026-11-08'), true);
  assert.equal(canShrink(s, 1, '2026-11-09'), false);
  assert.equal(planWeekOf(s, '2027-12-01'), 13);
});

test('статус дня зависит от недели', () => {
  const s = emptyState();
  s.startDate = '2026-11-02';
  s.days['2026-11-03'] = { done: { kana: true } };
  assert.equal(dayStatus(s, '2026-11-03'), 'full');
  s.days['2026-11-10'] = { done: { kana: true, anki: true } }; // неделя 2: kana+anki+wagotabi
  assert.equal(dayStatus(s, '2026-11-10'), 'light');
  s.days['2026-11-11'] = { done: {}, bad: true };
  assert.equal(dayStatus(s, '2026-11-11'), 'light');
});

test('серия: один лёгкий день в неделю не рвёт', () => {
  const s = emptyState();
  s.startDate = '2026-10-05'; // неделя 2 начинается 12.10
  // пн 16.11 .. ср 18.11 полные, чт 19.11 плохой день, пт 20.11 полный
  for (const k of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20']) s.days[k] = structuredClone(full2);
  s.days['2026-11-19'] = { done: {}, bad: true };
  let r = computeStreak(s, '2026-11-20');
  assert.equal(r.current, 5);
  // второй лёгкий день в ту же неделю рвёт
  s.days['2026-11-21'] = { done: { anki: true } };
  assert.equal(computeStreak(s, '2026-11-21').current, 5); // сегодня ещё идёт
  r = computeStreak(s, '2026-11-22'); // день закончился — серия прервалась
  assert.equal(r.current, 0);
  assert.equal(r.best, 5);
  assert.equal(r.marks['2026-11-21'], 'light-broke');
  // новая неделя — снова можно
  s.days['2026-11-22'] = structuredClone(full2);
  s.days['2026-11-23'] = { done: {}, bad: true };
  r = computeStreak(s, '2026-11-23');
  assert.equal(r.current, 2);
});

test('серия: сегодня пустое не рвёт, пропуск рвёт', () => {
  const s = emptyState();
  s.startDate = '2026-10-05';
  s.days['2026-11-15'] = structuredClone(full2);
  s.days['2026-11-16'] = structuredClone(full2);
  assert.equal(computeStreak(s, '2026-11-17').current, 2);
  assert.equal(computeStreak(s, '2026-11-18').current, 0);
  assert.equal(gapBeforeToday(s, '2026-11-20'), 3);
});

test('серия: незаконченный сегодня не рвёт, даже если лёгкий день уже был', () => {
  const s = emptyState();
  s.startDate = '2026-10-05';
  s.days['2026-11-16'] = { done: {}, bad: true };
  s.days['2026-11-17'] = structuredClone(full2);
  s.days['2026-11-18'] = { done: { anki: true } }; // сегодня, ещё в процессе
  assert.equal(computeStreak(s, '2026-11-18').current, 2);
  assert.equal(computeStreak(s, '2026-11-19').current, 0); // день закончился лёгким — серия прервалась
});
