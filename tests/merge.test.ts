import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyState, type State } from '../src/logic.ts';
import { merge, stampChanges } from '../src/merge.ts';

function edit(s: State, fn: (s: State) => void, t: number): State {
  const n = structuredClone(s);
  fn(n);
  stampChanges(s, n, t);
  return n;
}

test('разные дни с двух устройств объединяются', () => {
  const base = emptyState();
  const pc = edit(base, (s) => (s.days['2026-11-17'] = { done: { anki: true } }), 100);
  const phone = edit(base, (s) => (s.days['2026-11-18'] = { done: { wagotabi: true } }), 200);
  const r = merge(pc, phone).state;
  assert.deepEqual(Object.keys(r.days).sort(), ['2026-11-17', '2026-11-18']);
  // и в обратную сторону тоже
  assert.deepEqual(Object.keys(merge(phone, pc).state.days).sort(), ['2026-11-17', '2026-11-18']);
});

test('один и тот же день — побеждает более свежая правка', () => {
  const base = emptyState();
  const pc = edit(base, (s) => (s.days['2026-11-18'] = { done: { anki: true } }), 100);
  const phone = edit(base, (s) => (s.days['2026-11-18'] = { done: { anki: true, wagotabi: true } }), 200);
  assert.deepEqual(merge(pc, phone).state.days['2026-11-18'].done, { anki: true, wagotabi: true });
  assert.deepEqual(merge(phone, pc).state.days['2026-11-18'].done, { anki: true, wagotabi: true });
});

test('удаление переносится и не воскресает', () => {
  let a = edit(emptyState(), (s) => (s.diary['2026-11-18'] = 'こんにちは'), 100);
  let b = merge(emptyState(), a).state; // телефон получил запись
  b = edit(b, (s) => delete s.diary['2026-11-18'], 200); // и удалил её
  a = merge(a, b).state;
  assert.equal(a.diary['2026-11-18'], undefined);
  // повторное слияние старой копии не возвращает запись
  assert.equal(merge(b, a).state.diary['2026-11-18'], undefined);
});

test('старые данные без времени изменений не теряются', () => {
  const old = emptyState();
  old.startDate = '2026-11-02';
  old.days['2026-11-03'] = { done: { kana: true } };
  const fresh = edit(emptyState(), (s) => (s.days['2026-11-18'] = { done: { anki: true } }), 100);
  const r = merge(fresh, old).state;
  assert.equal(r.startDate, '2026-11-02');
  assert.ok(r.days['2026-11-03'] && r.days['2026-11-18']);
});

test('напоминание не синхронизируется', () => {
  const a = emptyState();
  a.reminder = { enabled: true, time: '07:00' };
  const b = edit(emptyState(), (s) => (s.reminder = { enabled: false, time: '22:00' }), 100);
  assert.equal(merge(a, b).state.reminder.time, '07:00');
});
