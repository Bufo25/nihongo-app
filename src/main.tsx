import { render } from 'preact';
import { App } from './app.tsx';
import { mirrorForWorker, requestPersistence } from './store.ts';
import { startReminderLoop } from './reminder.ts';
import './install.ts';
import './styles.css';

render(<App />, document.getElementById('app')!);

mirrorForWorker();
requestPersistence();
startReminderLoop();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW', e));
}
