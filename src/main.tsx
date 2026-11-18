import { render } from 'preact';
import { App } from './app.tsx';
import { mirrorForWorker, requestPersistence } from './store.ts';
import { startReminderLoop } from './reminder.ts';
import { startAutoSync } from './sync.ts';
import { autoPullAnki } from './anki.ts';
import './install.ts';
import { handleYandexReturn } from './yandex.ts';
import { setYandexReturn } from './sync.ts';
import './styles.css';

// вернулись со страницы входа Яндекса — забрать токен до первой отрисовки
setYandexReturn(handleYandexReturn());

render(<App />, document.getElementById('app')!);

mirrorForWorker();
requestPersistence();
startReminderLoop();
startAutoSync();
autoPullAnki();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW', e));
}
