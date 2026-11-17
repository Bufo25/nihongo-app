// Перехват системного предложения «Установить приложение» (Chrome/Edge).

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  subs.forEach((f) => f());
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  subs.forEach((f) => f());
});

export function getInstallPrompt() {
  return deferred;
}

export function onInstallPromptChange(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
