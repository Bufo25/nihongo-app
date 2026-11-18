// GitHub: данные — один файл в закрытом репозитории (Contents API).
// Доступ — fine-grained токен только к этому репозиторию с правом Contents: Read and write.
// API GitHub разрешает запросы из браузера (CORS), сервер не нужен.
import { getDevice, setDevice } from './device.ts';
import { ConflictError, NeedAuthError, step, type Provider, type RemoteFile } from './provider-base.ts';

const FILE = 'nihongo-data.json';
let sha: string | null = null; // версия файла, прочитанная последней — нужна для записи

function repo(): string {
  return getDevice().githubRepo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getDevice().githubToken.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function url(): string {
  return `https://api.github.com/repos/${repo()}/contents/${FILE}`;
}

function explain(status: number): Error {
  if (status === 401) {
    return new NeedAuthError('Токен GitHub не подходит или истёк — создай новый и вставь в настройках');
  }
  if (status === 403 || status === 404) {
    return new Error(`Нет доступа к репозиторию «${repo()}». Проверь название и что у токена есть право Contents: Read and write на этот репозиторий.`);
  }
  return new Error(`GitHub: ошибка ${status}`);
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function checkRepo(): Promise<void> {
  const res = await step('проверить репозиторий на GitHub', () =>
    fetch(`https://api.github.com/repos/${repo()}`, { headers: headers(), cache: 'no-store' }),
  );
  if (!res.ok) throw explain(res.status);
  const j = (await res.json()) as { private: boolean };
  if (!j.private) throw new Error(`Репозиторий «${repo()}» открытый — дневник и отметки увидят все. Сделай его закрытым (Settings → Danger Zone → Change visibility).`);
}

async function read(): Promise<RemoteFile | null> {
  const res = await step('прочитать файл с GitHub', () => fetch(url(), { headers: headers(), cache: 'no-store' }));
  if (res.status === 404) {
    // файла ещё нет — но, может, нет и доступа к репозиторию: проверим, чтобы ошибка была понятной
    await checkRepo();
    sha = null;
    return null;
  }
  if (!res.ok) throw explain(res.status);
  const j = (await res.json()) as { sha: string; content: string; encoding: string; download_url: string };
  sha = j.sha;
  if (j.encoding === 'base64' && j.content) return JSON.parse(fromBase64(j.content)) as RemoteFile;
  // файл больше 1 МБ — тогда содержимое приходит отдельно
  const raw = await step('скачать большой файл с GitHub', () =>
    fetch(url(), { headers: { ...headers(), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }),
  );
  if (!raw.ok) throw explain(raw.status);
  return (await raw.json()) as RemoteFile;
}

async function write(f: RemoteFile): Promise<void> {
  const body: Record<string, string> = {
    message: `Синхронизация ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    content: toBase64(JSON.stringify(f)),
  };
  if (sha) body.sha = sha;
  const res = await step('записать файл на GitHub', () =>
    fetch(url(), { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  );
  if (res.status === 409 || res.status === 422) {
    // файл успел поменяться с другого устройства — синхронизация перечитает и сольёт заново
    sha = null;
    throw new ConflictError();
  }
  if (!res.ok) throw explain(res.status);
  sha = ((await res.json()) as { content: { sha: string } }).content.sha;
}

export const githubProvider: Provider = {
  id: 'github',
  title: 'GitHub',
  ready: () => !!(getDevice().githubToken.trim() && repo().includes('/')),
  signIn: async () => {
    if (!getDevice().githubToken.trim()) throw new Error('Вставь токен');
    if (!repo().includes('/')) throw new Error('Укажи репозиторий в виде «логин/название»');
  },
  read,
  write,
  signOut: async () => {
    sha = null;
    setDevice({ githubToken: '' });
  },
};
