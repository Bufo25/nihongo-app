// Где хранится копия данных: Яндекс Диск или Google Drive. Логика слияния общая (sync.ts).
import { getDevice } from './device.ts';
import { googleProvider } from './gdrive.ts';
import { yandexProvider } from './yandex.ts';
import type { Provider, ProviderId } from './provider-base.ts';

export type { RemoteFile, Provider, ProviderId } from './provider-base.ts';
export { NeedAuthError, StepError, step } from './provider-base.ts';

export function provider(): Provider {
  return getDevice().syncProvider === 'google' ? googleProvider : yandexProvider;
}

export const PROVIDERS: Record<ProviderId, Provider> = { yandex: yandexProvider, google: googleProvider };
