/// <reference lib="webworker" />
// Service worker: офлайн-кэш всех файлов приложения + фоновое напоминание.
import { REMINDER_BODY, REMINDER_TITLE, shouldRemindNow } from './idb.ts';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[];
};

const manifest = self.__WB_MANIFEST;
const version = manifest.map((e) => e.revision ?? e.url).join('|');
let h = 0;
for (let i = 0; i < version.length; i++) h = (h * 31 + version.charCodeAt(i)) | 0;
const CACHE = `nihongo-${(h >>> 0).toString(36)}`;

// В манифесте бывают дубли (иконки), а cache.addAll на дублях падает.
const urls = [...new Set(manifest.map((e) => new URL(e.url, self.registration.scope).href))];
const indexUrl = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(urls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nihongo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  // словарь: не в общем кэше версии (10+ МБ не качаем при установке), а в своём — при первом открытии читалки
  if (req.url.includes('/dict/')) {
    event.respondWith(dictFetch(req));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(caches.match(indexUrl, { ignoreVary: true }).then((r) => r ?? fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r ?? fetch(req)));
});

async function maybeNotify() {
  if (await shouldRemindNow()) {
    await self.registration.showNotification(REMINDER_TITLE, {
      body: REMINDER_BODY,
      icon: new URL('icon-192.png', self.registration.scope).href,
      badge: new URL('icon-192.png', self.registration.scope).href,
      tag: 'daily-reminder',
    });
  }
}

// Periodic Background Sync — работает в установленном приложении в Chrome/Edge (Android, Windows).
self.addEventListener('periodicsync', ((event: Event & { tag: string; waitUntil(p: Promise<unknown>): void }) => {
  if (event.tag === 'daily-reminder') event.waitUntil(maybeNotify());
}) as EventListener);

self.addEventListener('message', (event) => {
  if (event.data === 'check-reminder') event.waitUntil(maybeNotify());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return (c as WindowClient).focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});

const DICT_CACHE = 'dict-cache';

/** index.json — сначала сеть (узнать о новой версии), файл словаря — сначала кэш (он неизменяемый, имя с хэшем). */
async function dictFetch(req: Request): Promise<Response> {
  const cache = await caches.open(DICT_CACHE);
  if (req.url.endsWith('/index.json')) {
    try {
      const res = await fetch(req);
      if (res.ok) await cache.put(req.url, res.clone());
      return res;
    } catch {
      return (await cache.match(req.url)) ?? Response.error();
    }
  }
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req.url, res.clone());
  return res;
}
