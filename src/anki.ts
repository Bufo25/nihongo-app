// Число слов из Anki через дополнение AnkiConnect (только ПК, Anki должен быть запущен).
import { getDevice } from './device.ts';
import { getState, update } from './store.ts';
import { dayKey } from './logic.ts';

async function call<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const { ankiUrl } = getDevice();
  let res: Response;
  try {
    // без Content-Type: application/json — тогда браузер не шлёт лишний предварительный CORS-запрос
    res = await fetch(ankiUrl, { method: 'POST', body: JSON.stringify({ action, version: 6, params }) });
  } catch {
    throw new Error('Anki не отвечает. Anki запущен? AnkiConnect установлен и сайт добавлен в webCorsOriginList?');
  }
  const j = (await res.json()) as { result: T; error: string | null };
  if (j.error) throw new Error(`AnkiConnect: ${j.error}`);
  return j.result;
}

/** Сколько слов уже начато: заметки колоды, у которых есть хотя бы одна не новая карточка. */
export async function ankiWordCount(): Promise<number> {
  const deck = getDevice().ankiDeck.trim() || 'KaishiRu*';
  const notes = await call<number[]>('findNotes', { query: `"deck:${deck}" -is:new` });
  return notes.length;
}

/** Записать число слов за сегодня. */
export async function pullFromAnki(): Promise<number> {
  const n = await ankiWordCount();
  const today = dayKey();
  if (getState().words[today] !== n) update((s) => (s.words[today] = n));
  return n;
}

/** При запуске на ПК: тихо подтянуть, если сегодня ещё не подтягивали. */
export function autoPullAnki(): void {
  if (!getDevice().ankiEnabled) return;
  setTimeout(() => pullFromAnki().catch(() => {}), 1500);
}
