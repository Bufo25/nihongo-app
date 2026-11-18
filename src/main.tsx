import { render } from 'preact';
import { App } from './app.tsx';
import { mirrorForWorker, requestPersistence } from './store.ts';
import { startReminderLoop } from './reminder.ts';
import { startAutoSync } from './sync.ts';
import { autoPullAnki } from './anki.ts';
import './install.ts';
import { registerServiceWorker } from './update.ts';
import { chime, initTimer, setOnFinish } from './timer.ts';
import { BLOCK_BY_ID } from './plan.ts';
import './styles.css';

render(<App />, document.getElementById('app')!);

mirrorForWorker();
requestPersistence();
startReminderLoop();
startAutoSync();

setOnFinish(async (block) => {
  chime();
  // приложение свёрнуто — сообщить уведомлением (если разрешены)
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.showNotification(`${BLOCK_BY_ID[block].title}: время вышло`, { body: 'Блок отмечен ✓', icon: 'icon-192.png', tag: 'timer' });
  }
});
initTimer();
autoPullAnki();

if (import.meta.env.PROD) registerServiceWorker();
