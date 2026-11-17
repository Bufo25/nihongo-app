// Мини-обёртка над IndexedDB (ключ → значение). Используется и приложением, и service worker.

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('nihongo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface ReminderMirror {
  enabled: boolean;
  time: string; // "HH:MM"
  lastActive: string | null; // последний день с отметками
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Общая проверка «пора ли напомнить»: включено, время прошло, сегодня ничего не отмечено
 * и сегодня ещё не напоминали. Если пора — запоминает, что напомнили.
 */
export async function shouldRemindNow(now = new Date()): Promise<boolean> {
  const r = await idbGet<ReminderMirror>('reminder');
  if (!r?.enabled) return false;
  const today = localDayKey(now);
  if (r.lastActive === today) return false;
  const [h, m] = r.time.split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return false;
  const last = await idbGet<string>('lastNotified');
  if (last === today) return false;
  await idbSet('lastNotified', today);
  return true;
}

export const REMINDER_TITLE = 'Японский: пора позаниматься';
export const REMINDER_BODY = 'Сегодня ещё ничего не отмечено. Хватит и 5 минут Anki.';
