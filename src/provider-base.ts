// Общие типы и помощники для хранилищ синхронизации.
import type { State } from './logic.ts';

export interface RemoteFile {
  app: 'nihongo';
  v: 1;
  savedAt: number;
  state: Partial<State>;
}

export type ProviderId = 'github' | 'google';

export interface Provider {
  id: ProviderId;
  title: string;
  /** Есть действующий вход. */
  ready(): boolean;
  /** Вход. Вызывать только по нажатию кнопки (Google открывает окно входа). */
  signIn(): Promise<void>;
  read(): Promise<RemoteFile | null>;
  write(f: RemoteFile): Promise<void>;
  signOut(): Promise<void>;
}

export class NeedAuthError extends Error {
  constructor(message = 'Нужно войти заново') {
    super(message);
  }
}

/** Файл в облаке поменялся с другого устройства между чтением и записью. */
export class ConflictError extends Error {
  constructor() {
    super('Файл изменился с другого устройства');
  }
}

/** Ошибка сети на конкретном шаге — чтобы было понятно, что именно не пустило. */
export class StepError extends Error {}

export async function step<T>(name: string, f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof TypeError) {
      // fetch падает TypeError, когда сеть недоступна или сервер не разрешил запрос из браузера (CORS)
      throw new StepError(
        navigator.onLine
          ? `Не удалось выполнить шаг «${name}»: сервер не ответил или не разрешил запрос из браузера.`
          : 'Нет интернета',
      );
    }
    throw e;
  }
}

