// Настройки этого устройства — не синхронизируются (ключи, токены, подключения).
import { useEffect, useState } from 'preact/hooks';

export interface Device {
  syncProvider: 'github' | 'google';
  githubRepo: string; // «логин/репозиторий»
  githubToken: string;
  githubTokenExp: string | null; // YYYY-MM-DD — до какого дня действует токен
  googleClientId: string;
  syncEnabled: boolean;
  driveFileId: string | null;
  lastSync: number | null;
  token: { value: string; exp: number } | null;
  ankiEnabled: boolean;
  ankiDeck: string;
  ankiUrl: string;
}

const KEY = 'nihongo-device';

const defaults = (): Device => ({
  syncProvider: 'github',
  githubRepo: '',
  githubToken: '',
  githubTokenExp: null,
  googleClientId: (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  syncEnabled: false,
  driveFileId: null,
  lastSync: null,
  token: null,
  ankiEnabled: false,
  ankiDeck: 'KaishiRu*',
  ankiUrl: 'http://127.0.0.1:8765',
});

function load(): Device {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const d = { ...defaults(), ...saved };
    // в первых версиях синхронизация была только через Google
    if (saved.syncEnabled && !saved.syncProvider) d.syncProvider = 'google';
    if (!d.googleClientId) d.googleClientId = defaults().googleClientId;
    // Яндекс Диск убран: его сервер скачивания не пускает запросы из браузера (нет CORS) — подключать заново
    if (saved.syncProvider === 'yandex') {
      d.syncProvider = 'github';
      d.syncEnabled = false;
      d.token = null;
      d.lastSync = null;
    }
    delete (d as Record<string, unknown>).yandexClientId;
    return d;
  } catch {
    return defaults();
  }
}

let device = load();
const subs = new Set<() => void>();

export function getDevice(): Device {
  return device;
}

export function setDevice(patch: Partial<Device>): void {
  device = { ...device, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(device));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export function useDevice(): Device {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return device;
}
