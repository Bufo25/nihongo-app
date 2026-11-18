const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:4173/';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const REPO = 'tester/nihongo-data';
const TOKEN = 'github_pat_test';
let file = null; // { sha, content(base64) }
let shaN = 0, puts = 0, conflictOnce = false, isPrivate = true;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (r, status, body) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });

async function github(r) {
  const req = r.request();
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
  if (req.headers()['authorization'] !== 'Bearer ' + TOKEN) return json(r, 401, { message: 'Bad credentials' });
  const u = new URL(req.url());
  if (u.pathname === `/repos/${REPO}`) return json(r, 200, { private: isPrivate });
  if (u.pathname !== `/repos/${REPO}/contents/nihongo-data.json`) return json(r, 404, { message: 'Not Found' });
  if (req.method() === 'GET') return file ? json(r, 200, { sha: file.sha, encoding: 'base64', content: file.content.replace(/(.{60})/g, '$1\n') }) : json(r, 404, { message: 'Not Found' });
  if (req.method() === 'PUT') {
    const b = JSON.parse(req.postData());
    if (conflictOnce) { conflictOnce = false; file = { ...file, sha: 's' + ++shaN }; return json(r, 409, { message: 'sha mismatch' }); }
    if ((file?.sha ?? undefined) !== b.sha) return json(r, file ? 409 : 422, { message: 'sha' });
    puts++;
    file = { sha: 's' + ++shaN, content: b.content };
    return json(r, file.sha === 's1' ? 201 : 200, { content: { sha: file.sha } });
  }
}
const remote = () => JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));

async function device(b, name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://api.github.com/**', github);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(name + ': ' + m.text()));
  return { ctx, p, errors };
}

async function connect(p, token = TOKEN) {
  await p.goto(APP + '#/settings');
  await p.reload();
  await p.getByPlaceholder('логин/nihongo-data').fill(REPO);
  await p.getByPlaceholder('github_pat_…').fill(token);
  await p.getByRole('button', { name: 'Подключить' }).click();
}
const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-v1')));

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'pc');
  const B = await device(b, 'phone');

  // старое подключение к Яндексу сбрасывается при обновлении
  await A.p.goto(APP);
  await A.p.evaluate(() => localStorage.setItem('nihongo-device', JSON.stringify({ syncProvider: 'yandex', syncEnabled: true, yandexClientId: 'x', token: { value: 't', exp: Date.now() + 1e10 } })));
  await A.p.reload();
  await A.p.getByRole('button', { name: 'Уже занимаюсь' }).click();
  await A.p.locator('select').selectOption('6');
  await A.p.getByRole('button', { name: 'Поехали' }).click();
  await A.p.locator('.checklist .check', { hasText: 'Anki' }).click();

  // неверный токен — понятная ошибка, синхронизация не включается
  await connect(A.p, 'wrong');
  await A.p.getByText(/Токен GitHub не подходит/).waitFor({ timeout: 4000 });
  ok(true, 'неверный токен: понятная ошибка');

  // открытый репозиторий — отказ
  isPrivate = false;
  await connect(A.p);
  await A.p.getByText(/открытый — дневник и отметки увидят все/).waitFor({ timeout: 4000 });
  ok(!file, 'открытый репозиторий: отказ, ничего не записано');
  isPrivate = true;

  await connect(A.p);
  await A.p.getByText('Подключено ✓').waitFor({ timeout: 5000 });
  ok(remote().state.startDate, 'ПК создал файл в репозитории');

  await connect(B.p);
  await B.p.getByText('Подключено ✓').waitFor({ timeout: 5000 });
  await B.p.goto(APP);
  await B.p.getByText('Неделя 6 из 12').waitFor({ timeout: 5000 });
  ok(await B.p.locator('.checklist .check', { hasText: 'Anki' }).locator('input').isChecked(), 'телефон получил данные с ПК');

  // японский текст и правка с телефона
  await B.p.goto(APP + '#/diary');
  await B.p.locator('textarea').fill('きょうは にほんごを べんきょうしました。');
  await B.p.getByRole('button', { name: 'Сохранить' }).click();
  await B.p.waitForTimeout(5500);
  await A.p.goto(APP + '#/diary');
  await A.p.reload();
  await A.p.waitForTimeout(1800);
  const sa = await st(A.p);
  ok(Object.values(sa.diary)[0] === 'きょうは にほんごを べんきょうしました。', 'японский текст дошёл до ПК без искажений');

  // конфликт: файл поменялся между чтением и записью — повтор и успех
  conflictOnce = true;
  await A.p.goto(APP + '#/');
  await A.p.locator('.checklist .check', { hasText: 'Wagotabi' }).click();
  await A.p.waitForTimeout(5500);
  const r = remote();
  const today = Object.keys(sa.days).sort().pop();
  ok(r.state.days[today].done.wagotabi, 'конфликт версий: перечитал, слил и записал');

  // отключение удаляет токен с устройства
  await A.p.goto(APP + '#/settings');
  A.p.once('dialog', (d) => d.accept());
  await A.p.getByRole('button', { name: 'Отключить' }).click();
  const dev = await A.p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-device')));
  ok(!dev.githubToken && !dev.syncEnabled && (await st(A.p)).days[today], 'отключение: токен удалён, данные на месте');

  console.log('   записей в репозиторий:', puts);
  const errs = [...A.errors, ...B.errors];
  ok(errs.length === 0, 'нет ошибок в консоли ' + errs.join('; '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
