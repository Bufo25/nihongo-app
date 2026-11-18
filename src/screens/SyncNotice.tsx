import { useState } from 'preact/hooks';
import { useDevice } from '../device.ts';
import { hasUnsynced, syncNow, useSyncStatus } from '../sync.ts';
import { tokenDaysLeft } from '../github.ts';

/** Плашка на «Сегодня»: появляется, только когда синхронизации нужно нажатие. */
export function SyncNotice() {
  const dev = useDevice();
  const st = useSyncStatus();
  const [err, setErr] = useState('');
  const left = dev.syncEnabled && dev.syncProvider === 'github' ? tokenDaysLeft() : null;
  if (left !== null && left <= 14 && st.phase !== 'need-auth') {
    return (
      <div class="banner sync-banner">
        <span>
          {left > 0 ? `Токен GitHub для синхронизации истекает через ${left} ${left === 1 ? 'день' : left < 5 ? 'дня' : 'дней'}.` : 'Срок токена GitHub закончился.'}{' '}
          Создай новый и вставь в настройках на каждом устройстве.
        </span>
        <a class="btn small" href="#/settings">
          Настройки
        </a>
      </div>
    );
  }
  if (!dev.syncEnabled || (st.phase !== 'need-auth' && st.phase !== 'error')) return null;
  return (
    <div class="banner sync-banner">
      <span>
        {st.phase === 'need-auth' && st.message && st.message !== 'Нужно войти заново'
          ? st.message
          : st.phase === 'need-auth'
          ? hasUnsynced()
            ? 'Есть отметки, которых нет на другом устройстве.'
            : 'Войди снова, чтобы получить отметки с другого устройства.'
          : st.message}
        {err && <span class="error-text"> {err}</span>}
      </span>
      <button
        class="btn small"
        disabled={st.phase === 'error' && !navigator.onLine}
        onClick={() => {
          setErr('');
          syncNow(true).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
        }}
      >
        Синхронизировать
      </button>
    </div>
  );
}
