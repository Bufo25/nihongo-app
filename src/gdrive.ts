// Google Drive: вход через Google Identity Services и файл в скрытой папке приложения (appDataFolder).
// Приложение видит только свой файл, а не остальной Диск.
import { getDevice, setDevice } from './device.ts';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'nihongo-data.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class NeedAuthError extends Error {
  constructor() {
    super('Нужно войти в Google заново');
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleOAuth {
  initTokenClient(cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string; message?: string }) => void;
  }): { requestAccessToken(o?: { prompt?: string }): void };
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

let gisLoading: Promise<GoogleOAuth> | null = null;

function loadGis(): Promise<GoogleOAuth> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('Google не загрузился')));
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('Нет связи с Google'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export function validToken(): string | null {
  const t = getDevice().token;
  return t && t.exp > Date.now() + 60_000 ? t.value : null;
}

/** Вход в Google. Открывает окно Google — вызывать только по нажатию кнопки. */
export async function signIn(): Promise<string> {
  const clientId = getDevice().googleClientId.trim();
  if (!clientId) throw new Error('Сначала вставь Client ID');
  const oauth = await loadGis();
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error_description || r.error || 'Вход отменён'));
        setDevice({ token: { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 } });
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Окно входа закрыто' : e.message || e.type)),
    });
    // если доступ уже давали — Google не спрашивает повторно, окно просто мелькнёт
    client.requestAccessToken({ prompt: getDevice().lastSync ? '' : 'consent' });
  });
}

export async function signOut(): Promise<void> {
  const t = getDevice().token?.value;
  setDevice({ token: null, syncEnabled: false, driveFileId: null, lastSync: null });
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t);
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const token = validToken();
  if (!token) throw new NeedAuthError();
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    setDevice({ token: null });
    throw new NeedAuthError();
  }
  if (!res.ok) throw new Error(`Google Drive: ошибка ${res.status}`);
  return res;
}

export async function findFile(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
  const j = (await res.json()) as { files: { id: string }[] };
  return j.files[0]?.id ?? null;
}

export async function download(id: string): Promise<unknown | null> {
  try {
    const res = await api(`${API}/files/${id}?alt=media`);
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) return null;
    throw e;
  }
}

export async function upload(id: string | null, data: unknown): Promise<string> {
  const body = JSON.stringify(data);
  if (id) {
    await api(`${UPLOAD}/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return id;
  }
  const boundary = 'nihongo' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return ((await res.json()) as { id: string }).id;
}
