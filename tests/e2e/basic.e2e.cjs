const { chromium, devices } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:4173/';
const ok = (c, m) => { if (!c) { throw new Error('FAIL: ' + m); } console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Notification.requestPermission = async () => 'granted';
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await p.clock.setFixedTime(new Date('2026-11-17T10:00:00'));
  await p.goto(APP);
  await p.getByText('С чего начнём?').waitFor();
  await p.getByRole('button', { name: 'Уже занимаюсь' }).click();
  await p.locator('select').selectOption('2');
  await p.getByRole('button', { name: 'Поехали' }).click();
  await p.getByText('Неделя 2 из 12').waitFor();
  ok(true, 'onboarding → неделя 2');
  ok(await p.getByText('Обязательное').isVisible(), 'чек-лист виден');
  ok((await p.locator('.checklist .check').count()) === 3, 'неделя 2: кана, anki, wagotabi');
  for (const t of ['Кана', 'Anki', 'Wagotabi']) await p.locator('.checklist .check', { hasText: t }).click();
  ok(await p.getByText('Обязательная часть сделана').isVisible(), 'награда после всех блоков');
  ok((await p.locator('.streak-chip').innerText()).trim() === '1', 'серия = 1');
  // перезагрузка — данные сохранились
  await p.reload();
  ok((await p.locator('.checklist input:checked').count()) === 3, 'отметки пережили перезагрузку');
  // плохой день — снять одну и нажать кнопку
  await p.locator('.checklist .check', { hasText: 'Wagotabi' }).click();
  await p.getByRole('button', { name: 'Плохой день' }).click();
  ok(await p.getByText('Плохой день засчитан').isVisible(), 'плохой день');
  // план — продление
  await p.goto(APP + '#/plan');
  await p.locator('#current-week').waitFor();
  ok((await p.locator('#current-week h3').innerText()).includes('Хирагана + старт игры'), 'текущая неделя подсвечена');
  await p.getByRole('button', { name: 'Продлить неделю на 7 дней' }).click();
  ok((await p.locator('#current-week .eyebrow').textContent()).includes('продлена +7'), 'неделя продлена');
  await p.getByRole('button', { name: 'Отменить продление' }).click();
  // чекпоинты
  await p.goto(APP + '#/checkpoints');
  await p.locator('.check', { hasText: 'Читаю всю хирагану' }).click();
  ok((await p.locator('.counter').first().innerText()) === '1/3', 'чекпоинт отмечен');
  // дневник
  await p.goto(APP + '#/diary');
  await p.locator('textarea').fill('きょうは がっこうに いきました。');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  ok(await p.locator('.diary-list li').count() === 1, 'запись в дневнике');
  // разбор
  await p.goto(APP + '#/review');
  const tas = p.locator('textarea');
  await tas.nth(0).fill('Каждый день Anki');
  await tas.nth(1).fill('Wagotabi в четверг — устал');
  await tas.nth(2).fill('Играть утром');
  await p.getByRole('button', { name: 'Сохранить' }).click();
  await p.reload();
  ok((await p.locator('textarea').nth(2).inputValue()) === 'Играть утром', 'разбор сохранён');
  // ресурсы
  await p.goto(APP + '#/resources');
  ok((await p.locator('.res-list a').count()) >= 18, 'ресурсы');
  await p.goto(APP + '#/settings');
  await p.getByText('Напоминание').first().waitFor();
  // офлайн
  await p.goto(APP);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await ctx.setOffline(true);
  await p.reload();
  await p.getByText('Неделя 2 из 12').waitFor({ timeout: 5000 }); ok(true, 'работает офлайн');
  await ctx.setOffline(false);
  // напоминание: новый день, ничего не отмечено, время прошло
  await ctx.grantPermissions(['notifications'], { origin: new URL(APP).origin });
  await p.clock.setFixedTime(new Date('2026-11-18T21:00:00'));
  await p.goto(APP + '#/settings');
  await p.locator('.switch').click();
  await p.locator('input[type=time]').fill('20:00');
  await p.locator('input[type=time]').dispatchEvent('change');
  await p.reload();
  await p.waitForTimeout(6500);
  const notified = await p.evaluate(() => new Promise(r => { const o = indexedDB.open('nihongo', 1); o.onsuccess = () => { const g = o.result.transaction('kv').objectStore('kv').get('lastNotified'); g.onsuccess = () => r(g.result); }; }));
  ok(notified === '2026-11-18', 'напоминание сработало (lastNotified=' + notified + ')');
  const notes = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length);
  console.log('   уведомлений показано:', notes);
  ok(errors.length === 0, 'нет ошибок в консоли: ' + errors.join('; '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
