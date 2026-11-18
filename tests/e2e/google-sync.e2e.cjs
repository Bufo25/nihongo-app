const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:4173/';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

// поддельный Google Drive в памяти, общий для двух устройств
const files = new Map();
let nextId = 1, uploads = 0;
async function drive(route) {
  const req = route.request();
  const u = new URL(req.url());
  if (req.headers()['authorization'] !== 'Bearer tok') return route.fulfill({ status: 401, body: '{}' });
  const cors = { 'access-control-allow-origin': '*' };
  if (u.pathname === '/drive/v3/files' && req.method() === 'GET')
    return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ files: [...files.keys()].map(id => ({ id })) }) });
  let m = u.pathname.match(/^\/drive\/v3\/files\/(.+)$/);
  if (m && req.method() === 'GET') return files.has(m[1]) ? route.fulfill({ headers: cors, contentType: 'application/json', body: files.get(m[1]) }) : route.fulfill({ status: 404, body: '{}' });
  m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(.+)$/);
  if (m && req.method() === 'PATCH') { uploads++; files.set(m[1], req.postData()); return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ id: m[1] }) }); }
  if (u.pathname === '/upload/drive/v3/files' && req.method() === 'POST') {
    uploads++;
    const body = req.postData();
    const parts = body.split(/--nihongo\w+/);
    const meta = JSON.parse(parts[1].split('\r\n\r\n')[1]);
    if (!meta.parents.includes('appDataFolder')) throw new Error('not appdata');
    const id = 'f' + nextId++;
    files.set(id, parts[2].split('\r\n\r\n')[1].trim());
    return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ id }) });
  }
  if (req.method() === 'OPTIONS') return route.fulfill({ headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  throw new Error('unexpected ' + req.method() + ' ' + u.pathname);
}

async function device(b, name, vp) {
  const ctx = await b.newContext({ viewport: vp });
  await ctx.addInitScript(() => {
    window.google = { accounts: { oauth2: {
      initTokenClient: (cfg) => ({ requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'tok', expires_in: 3600 }), 20); } }),
      revoke() {},
    } } };
  });
  await ctx.route('https://www.googleapis.com/**', drive);
  await ctx.route('http://127.0.0.1:8765/**', (r) => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ result: Array.from({ length: 312 }, (_, i) => i), error: null }) }));
  await ctx.route('http://127.0.0.1:8765', (r) => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ result: Array.from({ length: 312 }, (_, i) => i), error: null }) }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text()));
  return { ctx, p, errors };
}

async function connect(p) {
  await p.goto(APP + '#/settings');
  await p.getByRole('button', { name: 'Google Drive' }).click();
  await p.getByPlaceholder(/apps.googleusercontent.com/).fill('123-test.apps.googleusercontent.com');
  await p.getByRole('button', { name: 'Войти в Google и подключить' }).click();
  await p.getByText(/последняя синхронизация: только что/).waitFor({ timeout: 5000 });
}

const doneOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-v1')).days);

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'pc', { width: 1280, height: 860 });
  const B = await device(b, 'phone', { width: 390, height: 844 });

  // ПК: начать план, отметить Anki, подключить Диск
  await A.p.goto(APP);
  await A.p.getByRole('button', { name: 'Уже занимаюсь' }).click();
  await A.p.locator('select').selectOption('5');
  await A.p.getByRole('button', { name: 'Поехали' }).click();
  await A.p.locator('.checklist .check', { hasText: 'Anki' }).click();
  await A.p.getByRole('button', { name: /Урок 1:/ }).click(); // урок 1 в процессе
  await A.p.getByRole('button', { name: /Урок 1:/ }).click(); // пройден
  await connect(A.p);
  ok(files.size === 1, 'ПК создал файл в appDataFolder');

  // телефон: пустой, подключает Диск — получает план
  await B.p.goto(APP);
  await B.p.getByText('С чего начнём?').waitFor();
  await connect(B.p);
  await B.p.goto(APP);
  await B.p.getByText('Неделя 5 из 12').waitFor();
  ok(true, 'телефон получил дату старта и неделю');
  ok(await B.p.locator('.checklist .check', { hasText: 'Anki' }).locator('input').isChecked(), 'телефон видит отметку Anki с ПК');
  ok((await B.p.getByRole('button', { name: /Урок 1:/ }).getAttribute('aria-label')).includes('пройден'), 'телефон видит пройденный урок 1');

  // телефон: отметить Wagotabi, ввести слова — автосинхронизация через ~4 с
  await B.p.locator('.checklist .check', { hasText: 'Wagotabi' }).click();
  await B.p.locator('.num-input').fill('150');
  await B.p.getByRole('button', { name: 'Записать' }).click();
  await B.p.waitForTimeout(5500);

  // ПК: вернуться в приложение → синхронизация
  await A.p.goto(APP);
  await A.p.waitForTimeout(1800);
  const da = await doneOf(A.p);
  const today = Object.keys(da).sort().pop();
  ok(da[today].done.wagotabi && da[today].done.anki, 'ПК получил Wagotabi с телефона');
  ok((await A.p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-v1')).words))[today] === 150, 'ПК получил число слов');

  // удаление: ПК снимает Anki → телефон тоже
  await A.p.locator('.checklist .check', { hasText: 'Anki' }).click();
  await A.p.waitForTimeout(5000);
  await B.p.goto(APP + '#/settings');
  await B.p.getByRole('button', { name: 'Синхронизировать' }).first().click();
  await B.p.waitForTimeout(800);
  const db = await doneOf(B.p);
  ok(!db[today].done.anki && db[today].done.wagotabi, 'снятая отметка тоже синхронизировалась');

  // тренажёр каны на телефоне
  await B.p.goto(APP + '#/kana');
  await B.p.locator('select').first().selectOption('choice');
  await B.p.locator('.field select').nth(2).selectOption('10');
  await B.p.getByRole('button', { name: /^Начать/ }).click();
  for (let i = 0; i < 30; i++) {
    if (await B.p.getByText('Результат').isVisible()) break;
    const big = await B.p.locator('.kana-big').textContent();
    const btn = B.p.locator('.choice').first();
    if (await btn.isEnabled()) await btn.click();
    await B.p.waitForTimeout(450);
    if (await B.p.getByRole('button', { name: 'Дальше' }).isVisible()) await B.p.getByRole('button', { name: 'Дальше' }).click();
  }
  await B.p.getByText('Результат').waitFor({ timeout: 3000 });
  ok(true, 'сессия тренажёра на 10 вопросов');
  const kanaB = await B.p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('nihongo-v1')).kana).length);
  ok(kanaB > 0, `статистика каны записана (${kanaB} знаков)`);
  await B.p.waitForTimeout(5000);
  await A.p.goto(APP + '#/kana');
  await A.p.reload();
  await A.p.waitForTimeout(1800);
  const kanaA = await A.p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('nihongo-v1')).kana).length);
  ok(kanaA === kanaB, 'статистика каны пришла на ПК');

  // ввод чтения
  await A.p.locator('select').first().selectOption('input');
  await A.p.getByRole('button', { name: /^Начать/ }).click();
  const k = await A.p.locator('.kana-big').textContent();
  await A.p.locator('.kana-input input').fill('zzz');
  await A.p.keyboard.press('Enter');
  ok(await A.p.getByText('Правильно:').isVisible(), 'ввод: неверный ответ показывает правильный (' + k + ')');
  await A.p.keyboard.press('Escape');

  // AnkiConnect на ПК
  await A.p.goto(APP + '#/settings');
  await A.p.getByRole('button', { name: 'настроить' }).click();
  await A.p.locator('.switch', { hasText: 'Подтягивать из Anki' }).click();
  await A.p.getByText(/Работает: начато 312/).waitFor({ timeout: 3000 });
  ok(true, 'AnkiConnect: проверка');
  await A.p.goto(APP + '#/progress');
  await A.p.getByRole('button', { name: 'Взять из Anki' }).click();
  await A.p.getByText('Из Anki: 312').waitFor({ timeout: 3000 });
  ok((await A.p.locator('.words-hero .num').textContent()) === '312', 'слова из Anki записаны');

  // истёкший вход: без нажатия не открываем окно Google, показываем кнопку
  await A.p.evaluate(() => { const d = JSON.parse(localStorage.getItem('nihongo-device')); d.token = null; localStorage.setItem('nihongo-device', JSON.stringify(d)); });
  await A.p.goto(APP);
  await A.p.waitForTimeout(1500);
  ok(await A.p.locator('.sync-banner').isVisible(), 'истёкший вход: плашка «Синхронизировать» на «Сегодня»');
  await A.p.locator('.sync-banner button').click();
  await A.p.waitForTimeout(800);
  ok(!(await A.p.locator('.sync-banner').isVisible()), 'после нажатия синхронизировано');

  // чекпоинты с подсказками
  await A.p.goto(APP + '#/checkpoints');
  ok(await A.p.getByText('уроков пройдено: 1/8').isVisible(), 'подсказка у чекпоинта уроков');
  ok(await A.p.getByText('сейчас 312').isVisible(), 'подсказка у чекпоинта слов');

  console.log('   загрузок на Диск:', uploads);
  const errs = [...A.errors, ...B.errors];
  ok(errs.length === 0, 'нет ошибок в консоли ' + errs.join('; '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
