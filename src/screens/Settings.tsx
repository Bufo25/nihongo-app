import { useEffect, useState } from 'preact/hooks';
import { requestPersistence, update } from '../store.ts';
import { emptyState, type State } from '../logic.ts';
import { askPermission, downloadIcs, notificationsSupported, registerPeriodic, testNotification, unregisterPeriodic, type PeriodicResult } from '../reminder.ts';
import { getInstallPrompt, onInstallPromptChange } from '../install.ts';
import { Header } from '../ui.tsx';

export function Settings({ s }: { s: State; today: string }) {
  const [perm, setPerm] = useState<string>('Notification' in window ? Notification.permission : 'unsupported');
  const [periodic, setPeriodic] = useState<PeriodicResult | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [canInstall, setCanInstall] = useState(!!getInstallPrompt());
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    if (s.reminder.enabled) registerPeriodic().then(setPeriodic);
    return onInstallPromptChange(() => setCanInstall(!!getInstallPrompt()));
  }, []);

  const toggleReminder = async () => {
    if (s.reminder.enabled) {
      update((st) => (st.reminder.enabled = false));
      unregisterPeriodic();
      return;
    }
    const p = await askPermission();
    setPerm(p);
    if (p !== 'granted') return;
    update((st) => (st.reminder.enabled = true));
    setPeriodic(await registerPeriodic());
  };

  const install = async () => {
    const p = getInstallPrompt();
    if (!p) return;
    await p.prompt();
    setCanInstall(false);
  };

  return (
    <div class="page">
      <Header title="Настройки" />

      <section class="card">
        <h2>Напоминание</h2>
        <p class="muted small-text">Приходит в выбранное время, если сегодня ещё ничего не отмечено.</p>
        {!notificationsSupported() ? (
          <div class="banner">
            Этот браузер не умеет уведомления.{ios && ' На iPhone сначала установи приложение на экран «Домой» (iOS 16.4+).'} Используй файл
            календаря ниже.
          </div>
        ) : (
          <>
            <div class="row between">
              <label class="switch">
                <input type="checkbox" checked={s.reminder.enabled} onChange={toggleReminder} />
                <span class="track" />
                <span>Напоминать</span>
              </label>
              <input
                type="time"
                value={s.reminder.time}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  if (v) update((st) => (st.reminder.time = v));
                }}
                aria-label="Время напоминания"
              />
            </div>
            {perm === 'denied' && (
              <div class="banner warn">Уведомления запрещены в настройках браузера для этого сайта. Разреши их там и попробуй снова.</div>
            )}
            {s.reminder.enabled && (
              <p class="muted small-text">
                {periodic === 'ok'
                  ? 'Фоновая проверка включена: напоминание придёт, даже если приложение закрыто (браузер проверяет примерно раз в час, поэтому возможна задержка).'
                  : 'Напоминание сработает, пока приложение открыто или свёрнуто. Чтобы оно приходило при закрытом приложении, установи его (Chrome/Edge) или добавь событие в календарь.'}
              </p>
            )}
            <div class="row">
              <button class="btn small" onClick={async () => setPerm((await testNotification()) ? 'granted' : Notification.permission)}>
                Проверить уведомление
              </button>
            </div>
          </>
        )}
        <hr />
        <p class="small-text">
          <b>Самый надёжный вариант</b> — ежедневное событие со звонком в календаре телефона или Outlook. Оно приходит всегда, но не знает,
          отметил ли ты что-то сегодня.
        </p>
        <button class="btn small" onClick={() => downloadIcs(s.reminder.time)}>
          Скачать событие календаря (.ics) на {s.reminder.time}
        </button>
      </section>

      <section class="card">
        <h2>Старт плана</h2>
        <label class="field">
          <span>Первый день недели 1</span>
          <input
            type="date"
            value={s.startDate ?? ''}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement).value;
              if (v) update((st) => (st.startDate = v));
            }}
          />
        </label>
        {s.weekLengths.some((l) => l > 7) && (
          <div class="row">
            <span class="muted small-text">
              Продлено недель: {s.weekLengths.filter((l) => l > 7).length}
            </span>
            <button
              class="btn ghost small"
              onClick={() => confirm('Сбросить все продления недель?') && update((st) => (st.weekLengths = Array(12).fill(7)))}
            >
              Сбросить продления
            </button>
          </div>
        )}
      </section>

      <section class="card">
        <h2>Приложение</h2>
        {standalone ? (
          <p class="small-text">Установлено ✓</p>
        ) : canInstall ? (
          <button class="btn primary" onClick={install}>
            Установить на это устройство
          </button>
        ) : (
          <ul class="plain small-text">
            <li>
              <b>Windows (Edge/Chrome):</b> значок «Установить» в адресной строке или меню ⋯ → «Приложения» → «Установить».
            </li>
            <li>
              <b>Android (Chrome):</b> меню ⋮ → «Добавить на главный экран» / «Установить приложение».
            </li>
            <li>
              <b>iPhone (Safari):</b> «Поделиться» → «На экран „Домой“».
            </li>
          </ul>
        )}
        <p class="muted small-text">После установки всё работает без интернета.</p>
      </section>

      <section class="card">
        <h2>Данные</h2>
        <p class="small-text">
          Всё хранится только на этом устройстве, без аккаунта и сервера. ПК и телефон ведут отметки отдельно.
        </p>
        <p class="small-text">
          Защита от автоочистки браузером:{' '}
          {persisted ? (
            <b>включена ✓</b>
          ) : (
            <button class="linklike" onClick={async () => setPersisted(await requestPersistence())}>
              включить
            </button>
          )}
        </p>
        <button
          class="btn danger small"
          onClick={() => {
            if (confirm('Удалить все отметки, разборы и дневник на этом устройстве? Это нельзя отменить.')) {
              update((st) => Object.assign(st, emptyState()));
            }
          }}
        >
          Удалить все данные
        </button>
      </section>

      <p class="muted center small-text">Японский с нуля · версия 1.0</p>
    </div>
  );
}
