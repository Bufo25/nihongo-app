// Общие типы и помощники для хранилищ синхронизации.
import type { State } from './logic.ts';

export interface RemoteFile {
  app: 'nihongo';
  v: 1;
  savedAt: number;
  state: Partial<State>;
}

export type ProviderId = 'yandex' | 'google';

export interface Provider {
  id: ProviderId;
  title: string;
  /** Есть действующий вход. */
  ready(): boolean;
  /** Вход. Вызывать только по нажатию кнопки. Яндекс уводит на свою страницу и возвращает обратно. */
  signIn(): Promise<void>;
  read(): Promise<RemoteFile | null>;
  write(f: RemoteFile): Promise<void>;
  signOut(): Promise<void>;
}

export class NeedAuthError extends Error {
  constructor() {
    super('Нужно войти заново');
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

