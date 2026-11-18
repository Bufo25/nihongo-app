// Таймер блока: «Wagotabi 15 мин». Переживает перезагрузку (время считается по часам, а не по тикам).
// По окончании отмечает блок сделанным и записывает минуты; досрочно — записывает, сколько успел.
import { useEffect, useState } from 'preact/hooks';
import { BLOCK_BY_ID, type BlockId } from './plan.ts';
import { dayKey } from './logic.ts';
import { update } from './store.ts';

const KEY = 'nihongo-timer';

interface TimerState {
  block: BlockId;
  date: string; // день, к которому относится занятие
  durationMs: number;
  startedAt: number | null; // null — на паузе
  elapsedBefore: number; // сколько набежало до последней паузы
}

let timer: TimerState | null = load();
const subs = new Set<() => void>();

function load(): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

function save(t: TimerState | null) {
  timer = t;
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

function elapsed(t: TimerState, now = Date.now()): number {
  return t.elapsedBefore + (t.startedAt ? now - t.startedAt : 0);
}

/** Сколько минут по умолчанию: нижняя граница нормы блока («10–15 мин» → 10). */
export function defaultMinutes(block: BlockId): number {
  return Number(BLOCK_BY_ID[block].time.match(/\d+/)?.[0] ?? 10);
}

export function timerBlock(): BlockId | null {
  return timer?.block ?? null;
}

export function startTimer(block: BlockId, minutes = defaultMinutes(block)): void {
  save({ block, date: dayKey(), durationMs: minutes * 60_000, startedAt: Date.now(), elapsedBefore: 0 });
  ensureTicking();
}

export function pauseTimer(): void {
  if (!timer?.startedAt) return;
  save({ ...timer, elapsedBefore: elapsed(timer), startedAt: null });
}

export function resumeTimer(): void {
  if (!timer || timer.startedAt) return;
  save({ ...timer, startedAt: Date.now() });
  ensureTicking();
}

export function addMinutes(min: number): void {
  if (timer) save({ ...timer, durationMs: timer.durationMs + min * 60_000 });
}

function logMinutes(t: TimerState, ms: number, markDone: boolean) {
  const min = Math.round(ms / 60_000);
  if (min <= 0 && !markDone) return;
  update((s) => {
    if (min > 0) {
      const m = (s.minutes[t.date] ??= {});
      m[t.block] = (m[t.block] ?? 0) + min;
    }
    if (markDone) (s.days[t.date] ??= { done: {} }).done[t.block] = true;
  });
}

/** Закончить раньше: done — блок сделан (отметить), иначе просто записать минуты. */
export function stopTimer(done: boolean): void {
  if (!timer) return;
  const t = timer;
  save(null);
  logMinutes(t, Math.min(elapsed(t), t.durationMs), done);
}

let onFinish: ((block: BlockId) => void) | null = null;
/** Последний таймер, который дошёл до конца, — для плашки «Готово». */
let finished: { block: BlockId; at: number } | null = null;
export function useFinished(): [{ block: BlockId; at: number } | null, () => void] {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return [
    finished,
    () => {
      finished = null;
      subs.forEach((f) => f());
    },
  ];
}
/** Что сделать, когда время вышло (звук, уведомление) — задаёт интерфейс. */
export function setOnFinish(f: (block: BlockId) => void) {
  onFinish = f;
}

/** Проверить, не вышло ли время (вызывается каждую секунду и при запуске). */
export function checkTimer(now = Date.now()): void {
  if (!timer || elapsed(timer, now) < timer.durationMs) return;
  const t = timer;
  finished = { block: t.block, at: now };
  save(null);
  logMinutes(t, t.durationMs, true);
  onFinish?.(t.block);
}

let ticking: ReturnType<typeof setInterval> | null = null;
function ensureTicking() {
  if (ticking) return;
  ticking = setInterval(() => {
    checkTimer();
    if (!timer) {
      clearInterval(ticking!);
      ticking = null;
    } else subs.forEach((f) => f());
  }, 1000);
}

export function initTimer(): void {
  checkTimer();
  if (timer) ensureTicking();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkTimer());
}

export interface TimerView {
  block: BlockId;
  total: number;
  left: number;
  running: boolean;
}

export function useTimer(): TimerView | null {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  if (!timer) return null;
  return { block: timer.block, total: timer.durationMs, left: Math.max(0, timer.durationMs - elapsed(timer)), running: !!timer.startedAt };
}

/** Короткий сигнал без файлов: два тона через Web Audio. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 0.45);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* без звука */
  }
  navigator.vibrate?.([200, 100, 200]);
}
