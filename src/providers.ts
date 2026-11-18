// Где хранится копия данных: закрытый репозиторий GitHub или Google Drive. Логика слияния общая (sync.ts).
import { getDevice } from './device.ts';
import { googleProvider } from './gdrive.ts';
import { githubProvider } from './github.ts';
import type { Provider, ProviderId } from './provider-base.ts';

export type { RemoteFile, Provider, ProviderId } from './provider-base.ts';
export { ConflictError, NeedAuthError, StepError, step } from './provider-base.ts';

export function provider(): Provider {
  return getDevice().syncProvider === 'google' ? googleProvider : githubProvider;
}

export const PROVIDERS: Record<ProviderId, Provider> = { github: githubProvider, google: googleProvider };
