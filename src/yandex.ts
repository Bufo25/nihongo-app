// Яндекс Диск: вход через OAuth Яндекса (токен в браузере, без сервера) и файл в папке приложения
// «Приложения/<название>» на Диске. Доступ только к этой папке (право cloud_api:disk.app_folder).
import { getDevice, setDevice } from './device.ts';
import { NeedAuthError, step, type Provider, type RemoteFile } from './provider-base.ts';

const API = 'https://cloud-api.yandex.net/v1/disk';
const PATH = 'app:/nihongo-data.json';
const STATE_KEY = 'nihongo-yandex-state';

/** Адрес, на который Яндекс вернёт после входа. Его же надо указать в настройках приложения на oauth.yandex.ru. */
export function yandexRedirectUri(): string {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function validToken(): string | null {
  const t = getDevice().token;
  return t && t.exp > Date.now() + 60_000 ? t.value : null;
}

async function signIn(): Promise<void> {
  const clientId = getDevice().yandexClientId.trim();
  if (!clientId) throw new Error('Сначала вставь ClientID');
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(STATE_KEY, state);
    localStorage.setItem(STATE_KEY, state); // на случай, если вернёмся в другую вкладку
  } catch {
    /* ignore */
  }
  const u = new URL('https://oauth.yandex.ru/authorize');
  u.searchParams.set('response_type', 'token');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', yandexRedirectUri());
  u.searchParams.set('state', state);
  location.assign(u.toString());
  // страница уходит на Яндекс; обещание не завершается
  await new Promise(() => {});
}

export interface YandexReturn {
  ok: boolean;
  message?: string;
}

/**
 * Вызывается при запуске: если вернулись со страницы входа Яндекса, забрать токен из адреса
 * (#access_token=…&expires_in=…&state=…) и убрать его из адресной строки.
 */
export function handleYandexReturn(): YandexReturn | null {
  const h = location.hash.slice(1);
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(STATE_KEY) ?? localStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', location.pathname + location.search + '#/settings');
  if (p.get('error')) {
    const e = p.get('error');
    return { ok: false, message: e === 'access_denied' ? 'Доступ не разрешён' : `Яндекс: ${p.get('error_description') || e}` };
  }
  if (!expected || p.get('state') !== expected) return { ok: false, message: 'Вход не подтверждён — попробуй ещё раз' };
  const token = p.get('access_token')!;
  const sec = Number(p.get('expires_in')) || 365 * 86400;
  setDevice({ token: { value: token, exp: Date.now() + sec * 1000 }, syncProvider: 'yandex', syncEnabled: true });
  return { ok: true };
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = validToken();
  if (!token) throw new NeedAuthError();
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `OAuth ${token}` } });
  if (res.status === 401 || res.status === 403) {
    setDevice({ token: null });
    throw new NeedAuthError();
  }
  return res;
}

async function read(): Promise<RemoteFile | null> {
  const res = await step('получить ссылку на файл', () => api(`/resources/download?path=${encodeURIComponent(PATH)}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Яндекс Диск: ошибка ${res.status} при чтении`);
  const { href } = (await res.json()) as { href: string };
  const file = await step('скачать файл с Диска', () => fetch(href));
  if (!file.ok) throw new Error(`Яндекс Диск: ошибка ${file.status} при скачивании`);
  return (await file.json()) as RemoteFile;
}

async function write(f: RemoteFile): Promise<void> {
  const res = await step('получить ссылку для загрузки', () =>
    api(`/resources/upload?path=${encodeURIComponent(PATH)}&overwrite=true`),
  );
  if (res.status === 507) throw new Error('На Яндекс Диске закончилось место');
  if (!res.ok) throw new Error(`Яндекс Диск: ошибка ${res.status} при подготовке загрузки`);
  const { href, method } = (await res.json()) as { href: string; method?: string };
  const put = await step('загрузить файл на Диск', () =>
    fetch(href, { method: method || 'PUT', body: new Blob([JSON.stringify(f)], { type: 'application/json' }) }),
  );
  if (!put.ok) throw new Error(`Яндекс Диск: ошибка ${put.status} при загрузке`);
}

export const yandexProvider: Provider = {
  id: 'yandex',
  title: 'Яндекс Диск',
  ready: () => !!validToken(),
  signIn,
  read,
  write,
  // токен Яндекса из браузера отозвать нельзя (нужен секрет приложения) — просто забываем его;
  // отозвать совсем можно в Яндекс ID → «Безопасность» → «Устройства и приложения» / «Доступы»
  signOut: async () => {},
};
