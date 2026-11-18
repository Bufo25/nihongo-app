import { useState } from 'preact/hooks';
import { useDevice } from '../device.ts';
import { hasUnsynced, syncNow, useSyncStatus } from '../sync.ts';

/** Плашка на «Сегодня»: появляется, только когда синхронизации нужно нажатие. */
export function SyncNotice() {
  const dev = useDevice();
  const st = useSyncStatus();
  const [err, setErr] = useState('');
  if (!dev.syncEnabled || (st.phase !== 'need-auth' && st.phase !== 'error')) return null;
  return (
    <div class="banner sync-banner">
      <span>
        {st.phase === 'need-auth'
          ? hasUnsynced()
            ? 'Есть отметки, которых нет на другом устройстве.'
            : 'Проверить отметки с другого устройства?'
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
