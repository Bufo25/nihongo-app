import { useEffect, useState } from 'preact/hooks';
import { dayKey, emptyState, lastActiveDay, type State } from './logic.ts';
import { idbSet } from './idb.ts';

const KEY = 'nihongo-v1';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    /* повреждённые данные — начинаем заново */
  }
  return emptyState();
}

let state: State = load();
const subs = new Set<() => void>();

export function getState(): State {
  return state;
}

/** Изменить состояние: fn мутирует копию, затем сохраняем и перерисовываем. */
export function update(fn: (s: State) => void): void {
  const next = structuredClone(state);
  fn(next);
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Не удалось сохранить', e);
  }
  mirrorForWorker();
  subs.forEach((f) => f());
}

export function replaceState(s: State): void {
  update((cur) => Object.assign(cur, s));
}

/** Service worker не видит localStorage — кладём ему нужное для напоминаний в IndexedDB. */
export function mirrorForWorker(): void {
  idbSet('reminder', {
    enabled: state.reminder.enabled,
    time: state.reminder.time,
    lastActive: lastActiveDay(state),
  }).catch(() => {});
}

export function useAppState(): State {
  const [, setN] = useState(0);
  useEffect(() => {
    const force = () => setN((n) => n + 1);
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);
  return state;
}

/** Сегодняшняя дата, обновляется после полуночи. */
export function useToday(): string {
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    const t = setInterval(() => setToday(dayKey()), 30_000);
    const onVis = () => setToday(dayKey());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return today;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
