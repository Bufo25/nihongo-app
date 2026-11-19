import { useEffect, useState } from 'preact/hooks';
import { applySynced, requestPersistence, update } from '../store.ts';
import { emptyState, type State } from '../logic.ts';
import { askPermission, downloadIcs, notificationsSupported, registerPeriodic, testNotification, unregisterPeriodic, type PeriodicResult } from '../reminder.ts';
import { getInstallPrompt, onInstallPromptChange } from '../install.ts';
import { Header } from '../ui.tsx';
import { setDevice, useDevice } from '../device.ts';
import { disconnect, hasUnsynced, syncNow, useSyncStatus } from '../sync.ts';
import { PROVIDERS } from '../providers.ts';
import { tokenDaysLeft } from '../github.ts';
import { ankiWordCount } from '../anki.ts';

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

      <SyncSection />

      <AnkiSection />

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
          Данные хранятся на этом устройстве. Если включена синхронизация — копия лежит ещё в твоём закрытом репозитории на GitHub (или на Google Drive).
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
            if (
              confirm(
                'Удалить все отметки, разборы и дневник на этом устройстве? Копия в облаке не удаляется — при следующей синхронизации данные вернутся.',
              )
            ) {
              // без отметок времени: удаление только здесь и не разъезжается на другие устройства
              applySynced({ ...emptyState(), reminder: s.reminder });
            }
          }}
        >
          Удалить данные на этом устройстве
        </button>
      </section>

      <p class="muted center small-text">Японский с нуля · версия 1.5</p>
    </div>
  );
}

function ago(t: number | null): string {
  if (!t) return 'ещё не было';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function SyncSection() {
  const dev = useDevice();
  const st = useSyncStatus();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const pid = dev.syncProvider;
  const p = PROVIDERS[pid];
  const filled = pid === 'github' ? !!(dev.githubRepo.trim() && dev.githubToken.trim()) : !!dev.googleClientId;
  const [showHelp, setShowHelp] = useState(!filled);

  const run = async (connecting = false) => {
    setErr('');
    setBusy(true);
    try {
      await syncNow(true);
      if (connecting) setJustConnected(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card">
      <h2>Синхронизация ПК и телефона</h2>
      <p class="muted small-text">
        Отметки, дневник, разборы, уроки, слова и статистика каны — одни и те же на всех устройствах.
      </p>
      {dev.syncEnabled ? (
        <>
          <p class="small-text">
            <b>{p.title}</b>
            {pid === 'github' && <span class="muted"> · {dev.githubRepo}</span>} ·{' '}
            {st.phase === 'syncing' ? (
              'синхронизирую…'
            ) : st.phase === 'error' || (st.phase === 'need-auth' && st.message && pid === 'github') ? (
              <span class="error-text">{st.message}</span>
            ) : (
              `последняя синхронизация: ${ago(dev.lastSync)}`
            )}
            {st.phase === 'need-auth' && pid === 'google' && ' · вход истёк — нажми «Синхронизировать»'}
            {st.phase !== 'syncing' && hasUnsynced() && ' · есть неотправленные изменения'}
          </p>
          {justConnected && st.phase === 'idle' && <p class="saved">Подключено ✓</p>}
          {pid === 'github' && <TokenExpiry />}
          <div class="row">
            <button class="btn primary small" onClick={() => run()} disabled={busy || st.phase === 'syncing'}>
              Синхронизировать
            </button>
            <button
              class="btn ghost small"
              onClick={() =>
                confirm(
                  pid === 'github'
                    ? 'Отключить синхронизацию на этом устройстве? Токен будет удалён с устройства, данные останутся и здесь, и в репозитории.'
                    : 'Отключить синхронизацию на этом устройстве? Данные останутся и здесь, и в облаке.',
                ) && disconnect()
              }
            >
              Отключить
            </button>
          </div>
          <p class="muted small-text">
            Синхронизирует сама при запуске, после отметок и при возврате в приложение.
            {pid === 'google'
              ? ' Вход в Google действует около часа — потом понадобится одно нажатие «Синхронизировать».'
              : ' Токен действует до даты, которую ты выбрал при создании.'}
          </p>
        </>
      ) : (
        <>
          <div class="seg">
            <button class={pid === 'github' ? 'on' : ''} onClick={() => setDevice({ syncProvider: 'github', token: null })}>
              GitHub
            </button>
            <button class={pid === 'google' ? 'on' : ''} onClick={() => setDevice({ syncProvider: 'google', token: null })}>
              Google Drive
            </button>
          </div>
          {pid === 'github' ? (
            <>
              <p class="muted small-text">Данные хранятся в одном файле в твоём закрытом репозитории на GitHub.</p>
              <label class="field">
                <span>Репозиторий</span>
                <input
                  class="text-input"
                  value={dev.githubRepo}
                  placeholder="логин/nihongo-data"
                  spellcheck={false}
                  autocomplete="off"
                  autocapitalize="off"
                  onInput={(e) => setDevice({ githubRepo: (e.target as HTMLInputElement).value.trim() })}
                />
              </label>
              <label class="field">
                <span>Токен доступа</span>
                <input
                  class="text-input"
                  type="password"
                  value={dev.githubToken}
                  placeholder="github_pat_…"
                  spellcheck={false}
                  autocomplete="off"
                  onInput={(e) => setDevice({ githubToken: (e.target as HTMLInputElement).value.trim() })}
                />
              </label>
            </>
          ) : (
            <label class="field">
              <span>OAuth Client ID</span>
              <input
                class="text-input"
                value={dev.googleClientId}
                placeholder="1234567890-abc….apps.googleusercontent.com"
                spellcheck={false}
                autocomplete="off"
                onInput={(e) => setDevice({ googleClientId: (e.target as HTMLInputElement).value.trim() })}
              />
            </label>
          )}
          <div class="row">
            <button class="btn primary small" onClick={() => run(true)} disabled={busy || !filled}>
              {busy ? 'Подключаю…' : pid === 'github' ? 'Подключить' : 'Войти в Google и подключить'}
            </button>
            <button class="linklike small-text" onClick={() => setShowHelp(!showHelp)}>
              {showHelp ? 'скрыть инструкцию' : pid === 'github' ? 'как создать репозиторий и токен?' : 'где взять Client ID?'}
            </button>
          </div>
        </>
      )}
      {err && <p class="error-text small-text">{err}</p>}
      {showHelp && !dev.syncEnabled && (pid === 'github' ? <GithubHelp /> : <GoogleHelp />)}
    </section>
  );
}

function TokenExpiry() {
  const dev = useDevice();
  const left = tokenDaysLeft();
  return (
    <div class="token-exp">
      <label class="field">
        <span>Токен действует до</span>
        <input
          type="date"
          value={dev.githubTokenExp ?? ''}
          onChange={(e) => setDevice({ githubTokenExp: (e.target as HTMLInputElement).value || null })}
        />
      </label>
      <p class="muted small-text">
        {left === null
          ? 'Укажи дату — приложение напомнит за две недели. Её видно на '
          : left > 0
            ? `Осталось ${left} дн. За две недели до конца появится напоминание. Дата — на `
            : 'Срок закончился — создай новый токен на '}
        <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener noreferrer">
          странице токенов GitHub
        </a>
        .
      </p>
    </div>
  );
}

function GithubHelp() {
  return (
    <ol class="plain small-text help">
      <li>
        Создай репозиторий на <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">github.com/new</a>: название{' '}
        <code>nihongo-data</code>, видимость <b>Private</b>. Остальное — по умолчанию.
      </li>
      <li>
        Создай токен на{' '}
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
          github.com/settings/personal-access-tokens/new
        </a>
        :
        <ul class="plain">
          <li>Token name — любое, например «nihongo-sync»; Expiration — год или «No expiration».</li>
          <li>
            Repository access → <b>Only select repositories</b> → выбери <code>nihongo-data</code>.
          </li>
          <li>
            Permissions → Repository permissions → <b>Contents: Read and write</b>. Больше ничего не включай.
          </li>
          <li>«Generate token» и скопируй его — GitHub покажет его только один раз.</li>
        </ul>
      </li>
      <li>
        Вставь сюда репозиторий (<code>логин/nihongo-data</code>) и токен. На телефоне — те же. Токен храни как пароль: не публикуй и не
        добавляй в репозиторий приложения.
      </li>
    </ol>
  );
}

function GoogleHelp() {
  return (
    <ol class="plain small-text help">
      <li>
        Открой <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">console.cloud.google.com</a> и создай
        проект.
      </li>
      <li>«APIs &amp; Services» → «Library» → <b>Google Drive API</b> → «Enable».</li>
      <li>
        «Google Auth Platform»: тип <b>External</b>, режим <b>Testing</b>, свою почту — в <b>Test users</b>.
      </li>
      <li>
        «Clients» → «Create client» → <b>Web application</b>, в «Authorized JavaScript origins» — <code>{location.origin}</code>
      </li>
      <li>Скопируй Client ID сюда. На втором устройстве — тот же Client ID и тот же аккаунт Google.</li>
    </ol>
  );
}

function AnkiSection() {
  const dev = useDevice();
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [open, setOpen] = useState(dev.ankiEnabled);
  const check = async () => {
    setMsg({ text: 'Спрашиваю Anki…' });
    try {
      const n = await ankiWordCount();
      setMsg({ text: `Работает: начато ${n} слов в «${dev.ankiDeck}».` });
      return true;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), err: true });
      return false;
    }
  };
  return (
    <section class="card">
      <div class="card-head">
        <h2>Anki на этом ПК</h2>
        {!open && (
          <button class="linklike small-text" onClick={() => setOpen(true)}>
            настроить
          </button>
        )}
      </div>
      <p class="muted small-text">Число слов будет подтягиваться само при запуске приложения. Только на ПК, где запущен Anki.</p>
      {open && (
        <>
          <ol class="plain small-text help">
            <li>
              В Anki: «Инструменты» → «Дополнения» → «Получить» → код <code>2055492159</code> (AnkiConnect). Перезапусти Anki.
            </li>
            <li>
              «Дополнения» → AnkiConnect → «Настройки» и добавь адрес приложения в <code>webCorsOriginList</code>:
              <pre class="code">"webCorsOriginList": ["http://localhost", "{location.origin}"]</pre>
            </li>
            <li>Браузер может спросить разрешение на доступ к устройствам в локальной сети — разреши.</li>
          </ol>
          <label class="field">
            <span>Колода (можно со звёздочкой)</span>
            <input class="text-input" value={dev.ankiDeck} spellcheck={false} onInput={(e) => setDevice({ ankiDeck: (e.target as HTMLInputElement).value })} />
          </label>
          <div class="row">
            <label class="switch">
              <input
                type="checkbox"
                checked={dev.ankiEnabled}
                onChange={async () => {
                  if (dev.ankiEnabled) setDevice({ ankiEnabled: false });
                  else if (await check()) setDevice({ ankiEnabled: true });
                }}
              />
              <span class="track" />
              <span>Подтягивать из Anki</span>
            </label>
            <button class="btn small" onClick={check}>
              Проверить
            </button>
          </div>
          {msg && <p class={`small-text ${msg.err ? 'error-text' : 'muted'}`}>{msg.text}</p>}
        </>
      )}
    </section>
  );
}
