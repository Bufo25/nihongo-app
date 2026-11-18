// Синхронизация с Google Drive: скачать файл, слить с локальными данными, загрузить результат.
import { useEffect, useState } from 'preact/hooks';
import { applySynced, getState, onLocalChange } from './store.ts';
import { emptyState, type State } from './logic.ts';
import { merge, syncPayload } from './merge.ts';
import { getDevice, setDevice } from './device.ts';
import { NeedAuthError, download, findFile, signIn, upload, validToken } from './gdrive.ts';

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'need-auth' | 'error';

interface SyncStatus {
  phase: SyncPhase;
  message?: string;
}

let status: SyncStatus = { phase: getDevice().syncEnabled ? 'idle' : 'off' };
const subs = new Set<() => void>();

function setStatus(s: SyncStatus) {
  status = s;
  subs.forEach((f) => f());
}

export function useSyncStatus(): SyncStatus {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return status;
}

/** Есть ли правки, которые ещё не ушли на Диск. */
export function hasUnsynced(): boolean {
  const last = getDevice().lastSync ?? 0;
  return Object.values(getState().mtime ?? {}).some((t) => t > last);
}

interface RemoteFile {
  app: 'nihongo';
  v: 1;
  savedAt: number;
  state: Partial<State>;
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Синхронизировать сейчас. interactive — вызвано нажатием кнопки, можно открыть окно входа Google.
 * Без нажатия работает, только пока действует токен (около часа после входа).
 */
export function syncNow(interactive = false): Promise<void> {
  if (!getDevice().syncEnabled && !interactive) return Promise.resolve();
  if (running) {
    // уже идёт: правки, сделанные за это время, отправим сразу после
    again = true;
    return running;
  }
  running = run(interactive).finally(() => {
    running = null;
    if (again) {
      again = false;
      if (hasUnsynced()) syncNow(false);
    }
  });
  return running;
}

async function run(interactive: boolean): Promise<void> {
  if (!navigator.onLine) {
    setStatus({ phase: 'error', message: 'Нет интернета — синхронизирую, когда появится' });
    return;
  }
  try {
    if (!validToken()) {
      if (!interactive) {
        setStatus({ phase: 'need-auth' });
        return;
      }
      await signIn();
    }
    setStatus({ phase: 'syncing' });
    const startedAt = Date.now();
    let fileId = getDevice().driveFileId;
    let remote: RemoteFile | null = null;
    if (fileId) remote = (await download(fileId)) as RemoteFile | null;
    if (!remote) {
      fileId = await findFile();
      remote = fileId ? ((await download(fileId)) as RemoteFile | null) : null;
    }

    // сливаем с тем, что есть локально прямо сейчас (правки во время загрузки не теряются)
    const local = getState();
    let merged = local;
    if (remote?.state) {
      const r = merge(local, { ...emptyState(), ...remote.state } as State);
      merged = r.state;
      if (r.fromRemote > 0) applySynced(merged);
    }

    const payload = syncPayload(merged);
    // загружаем, только если у нас есть что-то, чего нет в файле
    const remoteState = remote?.state ? ({ ...emptyState(), ...remote.state } as State) : null;
    if (!remoteState || merge(remoteState, merged).fromRemote > 0) {
      const file: RemoteFile = { app: 'nihongo', v: 1, savedAt: Date.now(), state: payload };
      fileId = await upload(fileId, file);
    }
    setDevice({ driveFileId: fileId, lastSync: startedAt, syncEnabled: true });
    setStatus({ phase: 'idle' });
  } catch (e) {
    if (e instanceof NeedAuthError) setStatus({ phase: 'need-auth' });
    else setStatus({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
    if (interactive) throw e;
  }
}

let started = false;

/** Автосинхронизация: при запуске, при возврате в приложение, через несколько секунд после правок. */
export function startAutoSync(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(false), ms);
  };
  onLocalChange(() => getDevice().syncEnabled && soon(4000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getDevice().syncEnabled) soon(500);
    // уходим из приложения — отправить несохранённое сразу
    if (document.visibilityState === 'hidden' && getDevice().syncEnabled && hasUnsynced()) syncNow(false);
  });
  window.addEventListener('online', () => getDevice().syncEnabled && soon(1000));
  setInterval(() => getDevice().syncEnabled && syncNow(false), 5 * 60_000);
  if (getDevice().syncEnabled) soon(800);
}
