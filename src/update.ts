// Обновление приложения: новый service worker взял управление → показать плашку «Обновить».
import { useEffect, useState } from 'preact/hooks';

let available = false;
const subs = new Set<() => void>();

export function markUpdateAvailable(): void {
  available = true;
  subs.forEach((f) => f());
}

export function useUpdateAvailable(): boolean {
  const [v, setV] = useState(available);
  useEffect(() => {
    const f = () => setV(available);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return v;
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // при самой первой установке управляющего worker'а нет — обновлением это не считаем
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) markUpdateAvailable();
  });
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      // открытое надолго приложение тоже узнаёт о новой версии: при возврате в него и раз в час
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      setInterval(check, 60 * 60 * 1000);
    })
    .catch((e) => console.warn('SW', e));
}
