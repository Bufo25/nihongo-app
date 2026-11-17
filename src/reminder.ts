// Напоминания: проверка, пока приложение открыто, + Periodic Background Sync, где он есть,
// + файл календаря (.ics) как надёжный запасной вариант.
import { REMINDER_BODY, REMINDER_TITLE, shouldRemindNow } from './idb.ts';

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function askPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

async function show() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) {
    await reg.showNotification(REMINDER_TITLE, { body: REMINDER_BODY, icon: 'icon-192.png', tag: 'daily-reminder' });
  } else if ('Notification' in window) {
    new Notification(REMINDER_TITLE, { body: REMINDER_BODY, icon: 'icon-192.png' });
  }
}

let started = false;

/** Пока вкладка/приложение открыто — проверяем раз в минуту. */
export function startReminderLoop(): void {
  if (started) return;
  started = true;
  const tick = async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (await shouldRemindNow()) await show();
    } catch (e) {
      console.warn(e);
    }
  };
  setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}

export type PeriodicResult = 'ok' | 'unsupported' | 'denied';

/** Фоновая проверка раз в ~час (Chrome/Edge, только установленное приложение). */
export async function registerPeriodic(): Promise<PeriodicResult> {
  try {
    const reg = (await navigator.serviceWorker?.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void> };
    };
    if (!reg?.periodicSync) return 'unsupported';
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (st.state !== 'granted') return 'denied';
    await reg.periodicSync.register('daily-reminder', { minInterval: 60 * 60 * 1000 });
    return 'ok';
  } catch {
    return 'unsupported';
  }
}

export async function unregisterPeriodic(): Promise<void> {
  try {
    const reg = (await navigator.serviceWorker?.getRegistration()) as
      | (ServiceWorkerRegistration & { periodicSync?: { unregister(tag: string): Promise<void> } })
      | undefined;
    await reg?.periodicSync?.unregister('daily-reminder');
  } catch {
    /* ignore */
  }
}

export async function testNotification(): Promise<boolean> {
  if ((await askPermission()) !== 'granted') return false;
  await show();
  return true;
}

/** Ежедневное событие календаря со звонком — срабатывает всегда, даже если приложение закрыто. */
export function downloadIcs(time: string): void {
  const [h, m] = time.split(':');
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nihongo s nulya//RU',
    'BEGIN:VEVENT',
    `UID:nihongo-daily-${Date.now()}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${date}T${h}${m}00`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Японский: обязательная часть',
    'DESCRIPTION:Anki + Wagotabi. В плохой день — только 5 минут повторений.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Японский: пора позаниматься',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'japanese-reminder.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
