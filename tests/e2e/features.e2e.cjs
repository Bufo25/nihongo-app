// Новые функции: ссылки недели, таймер, подсказки дневника, режимы тренажёра, статистика, плашка обновления.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = process.env.APP_URL || 'http://localhost:4173/';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

// чтения слов берём прямо из исходника — чтобы тест отвечал правильно
const src = fs.readFileSync(path.join(__dirname, '../../src/kana-words.ts'), 'utf8');
const READING = Object.fromEntries([...src.matchAll(/\['([^']+)', '[^']*', '([^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]));

const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-v1')));
// записи за день хранятся по устройствам («день@id») — складываем
const dayMinutes = (s, day, block) =>
  Object.entries(s.minutes).filter(([k]) => k.startsWith(day)).reduce((a, [, v]) => a + (v[block] ?? 0), 0);
const dayKana = (s, day) => Object.entries(s.kanaLog).filter(([k]) => k.startsWith(day)).reduce((a, [, v]) => a + v.n, 0);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    // японский голос-заглушка: запоминаем, что «произнесено»
    const v = { lang: 'ja-JP', localService: true, name: 'Test JA', default: false, voiceURI: 'ja' };
    window.__spoken = [];
    speechSynthesis.getVoices = () => [v];
    speechSynthesis.speak = (u) => window.__spoken.push(u.text);
    speechSynthesis.cancel = () => {};
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.clock.install({ time: new Date('2026-11-17T10:00:00') });

  await p.goto(APP);
  await p.getByRole('button', { name: 'Поехали' }).click(); // неделя 1
  await p.getByText('Неделя 1 из 12').waitFor();
  const links = await p.locator('.week-links a').allTextContents();
  ok(links.some((l) => l.includes('kana.pro')) && links.some((l) => l.includes('NHK')), 'ссылки недели: ' + links.join(', '));

  // таймер: ▶ 15 у «Кана», перематываем 15 минут → блок отмечен, минуты записаны
  await p.locator('.checklist li', { hasText: 'Кана' }).locator('.timer-chip').click();
  await p.locator('.timer-bar').waitFor();
  ok((await p.locator('.timer-left').textContent()) === '15:00', 'таймер запущен на 15:00');
  await p.clock.runFor(5 * 60_000);
  ok((await p.locator('.timer-left').textContent()) === '10:00', 'через 5 минут осталось 10:00');
  await p.reload();
  ok(await p.locator('.timer-bar').isVisible(), 'таймер пережил перезагрузку');
  await p.clock.runFor(10 * 60_000 + 2000);
  await p.getByText(/Время вышло — «Кана» отмечен/).waitFor({ timeout: 3000 });
  let s = await st(p);
  ok(s.days['2026-11-17'].done.kana && dayMinutes(s, '2026-11-17', 'kana') === 15, 'по окончании: блок отмечен, 15 минут записаны');
  ok(Object.keys(s.minutes).every((k) => /^\d{4}-\d{2}-\d{2}@\w+$/.test(k)), 'минуты записаны под ключом устройства: ' + Object.keys(s.minutes).join(', '));
  await p.getByRole('button', { name: 'Ок' }).click();

  // досрочный «Стоп» — записывает минуты без отметки (неделя 2+ не нужна: снимем кану и запустим снова)
  await p.locator('.checklist .check', { hasText: 'Кана' }).click();
  await p.locator('.checklist li', { hasText: 'Кана' }).locator('.timer-chip').click();
  await p.clock.runFor(4 * 60_000);
  await p.locator('.timer-bar button', { hasText: 'Стоп' }).click();
  s = await st(p);
  ok(!s.days['2026-11-17'].done.kana && dayMinutes(s, '2026-11-17', 'kana') === 19, 'Стоп: +4 минуты, блок не отмечен');

  // подсказка дневника
  await p.goto(APP + '#/diary');
  await p.locator('.prompt-card').waitFor();
  const example = await p.locator('.prompt-example').textContent();
  await p.getByRole('button', { name: /вставить образец/ }).click();
  ok((await p.locator('textarea').inputValue()) === example, 'образец из подсказки вставлен');
  const first = await p.locator('.prompt-topic').textContent();
  await p.getByRole('button', { name: 'другая' }).click();
  ok((await p.locator('.prompt-topic').textContent()) !== first, 'другая подсказка');

  // тренажёр: чтение → знак
  await p.goto(APP + '#/kana');
  await p.getByRole('radio', { name: 'Чтение → знак' }).click();
  await p.locator('.field select').last().selectOption('10');
  await p.getByRole('button', { name: /^Начать/ }).click();
  await p.clock.runFor(200); // при подменённых часах отработать эффекты отрисовки
  const prompt = (await p.locator('.kana-big').textContent()).trim();
  ok(/^[а-яё]+$/.test(prompt), 'показано чтение: ' + prompt);
  ok((await p.locator('.choice.ja').count()) === 4, '4 знака на выбор');
  await p.getByRole('button', { name: '✕ Закончить' }).click();

  // на слух: знак произносится
  await p.getByRole('radio', { name: 'На слух' }).click();
  await p.clock.runFor(200);
  await p.getByRole('button', { name: /^Начать/ }).click();
  await p.clock.runFor(300);
  await p.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 5000 }).catch(() => {});
  const spoken = await p.evaluate(() => window.__spoken);
  ok(spoken.length > 0 && /^[぀-ゟ]+$/.test(spoken[0]), 'на слух: произнесено ' + spoken[0]);
  await p.locator('.speak-btn').click();
  ok((await p.evaluate(() => window.__spoken.length)) === spoken.length + 1, 'кнопка 🔊 повторяет');
  await p.getByRole('button', { name: '✕ Закончить' }).click();

  // слова: ввод чтения
  await p.getByRole('radio', { name: 'Слова' }).click();
  for (const r of ['ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa']) await p.locator('.chip', { hasText: { ta: 'た', na: 'な', ha: 'は', ma: 'ま', ya: 'や', ra: 'ら', wa: 'わ' }[r] }).click();
  await p.locator('.field select').first().selectOption('input');
  await p.getByRole('button', { name: /^Начать/ }).click();
  await p.clock.runFor(200);
  for (let i = 0; i < 10; i++) {
    if (await p.getByText('Результат').isVisible()) break;
    const word = (await p.locator('.kana-big').textContent()).trim();
    const input = p.locator('.kana-input input');
    await input.waitFor();
    if (i === 0) {
      await input.fill('zzz');
      await p.keyboard.press('Enter');
      await p.getByText('Правильно:').waitFor();
      ok(true, `слово ${word}: неверный ответ показывает чтение и перевод`);
      await p.getByRole('button', { name: 'Дальше' }).click();
      await p.clock.runFor(200);
      await p.waitForFunction((prev) => document.querySelector('.kana-big')?.textContent.trim() !== prev, word, { timeout: 5000 }).catch(async (e) => {
        throw new Error('после неверного ответа слово не сменилось: ' + word + ' / ' + (await p.locator('.page').innerText()).replace(/\n/g, ' | ').slice(0, 400));
      });
      continue;
    }
    // долгие гласные без двоеточия тоже засчитываются
    await input.fill(READING[word].replace(/:/g, ''));
    await p.keyboard.press('Enter');
    await p.locator('.kana-feedback .saved').waitFor({ timeout: 2000 });
    await p.clock.runFor(1200);
    // дождаться следующего слова (или результата), прежде чем читать его
    await p.waitForFunction(
      (prev) => document.body.innerText.includes('Результат') || (document.querySelector('.kana-big')?.textContent.trim() !== prev && !document.querySelector('.kana-input input')?.disabled),
      word,
      { timeout: 5000 },
    ).catch(async () => {
      throw new Error('после верного ответа нет следующего слова: ' + word + ' / ' + (await p.locator('.page').innerText()).replace(/\n/g, ' | ').slice(0, 400));
    });
  }
  await p.getByText('Результат').waitFor({ timeout: 3000 });
  ok((await p.locator('.result-stats b').first().textContent()) === '90%', 'слова: 9 из 10 верно');
  s = await st(p);
  ok(dayKana(s, '2026-11-17') >= 10 && Object.keys(s.kana).some((k) => k.startsWith('w:')), 'журнал тренажёра и статистика слов записаны');

  // заголовки разделов в «Ресурсах» не налезают на карточки
  await p.goto(APP + '#/resources');
  const gap = await p.evaluate(() => {
    const h = document.querySelector('.section-title');
    const card = h.nextElementSibling;
    return card.getBoundingClientRect().top - h.getBoundingClientRect().bottom;
  });
  ok(gap >= 4, 'отступ под заголовком раздела: ' + gap + 'px');

  // статистика
  await p.goto(APP + '#/stats');
  await p.locator('.kpi').first().waitFor();
  const kpis = await p.locator('.kpi-value').allTextContents();
  ok(kpis[2] !== '0 мин' && kpis[3].endsWith('%'), 'плитки статистики: ' + kpis.join(' | '));
  ok(
    (await p.locator('.heat-cell[aria-label^="вторник, 17 ноября"]').getAttribute('class')).includes('h-none'),
    'карта активности: сегодня есть, без отметок — «не отмечено»',
  );
  const lastCol = p.locator('.col').last();
  await lastCol.focus();
  // подсказка того графика, где фокус (у другого может висеть подсказка от мыши)
  const chart = p.locator('.chart-wrap', { has: lastCol });
  ok(await chart.locator('.tip').isVisible(), 'подсказка у столбика при фокусе');
  ok(errors.length === 0, 'нет ошибок в консоли ' + errors.join('; '));
  await ctx.close();

  // Android: список голосов пуст, но говорить браузер умеет — режим «На слух» всё равно работает
  const ctx4 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx4.addInitScript(() => {
    window.__spoken = [];
    speechSynthesis.getVoices = () => [];
    speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text + '|' + u.lang);
      setTimeout(() => u.dispatchEvent(new Event('start')), 50);
    };
  });
  const p4 = await ctx4.newPage();
  await p4.goto(APP);
  await p4.getByRole('button', { name: 'Поехали' }).click();
  await p4.goto(APP + '#/kana');
  await p4.getByRole('radio', { name: 'На слух' }).click();
  await p4.getByText(/Японский голос в списке не найден/).waitFor({ timeout: 4000 });
  await p4.getByRole('button', { name: 'Проверить голос' }).click();
  await p4.getByText(/Браузер начал говорить/).waitFor({ timeout: 4000 });
  ok(true, 'пустой список голосов: проверка голоса сообщает, что браузер говорит');
  ok(await p4.getByRole('button', { name: /^Начать/ }).isEnabled(), 'пустой список голосов не блокирует режим');
  await p4.getByRole('button', { name: /^Начать/ }).click();
  await p4.waitForFunction(() => window.__spoken.length >= 2, null, { timeout: 4000 });
  const sp4 = await p4.evaluate(() => window.__spoken);
  ok(sp4[1].endsWith('|ja-JP'), 'произносится по языку ja-JP: ' + sp4[1]);
  await ctx4.close();

  // дневник, открытый через полночь, пишет в новый день
  const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p3 = await ctx3.newPage();
  await p3.clock.install({ time: new Date('2026-11-17T23:59:00') });
  await p3.goto(APP);
  await p3.getByRole('button', { name: 'Поехали' }).click();
  await p3.goto(APP + '#/diary');
  await p3.getByText('Сегодня, 17 ноября').waitFor();
  await p3.clock.runFor(2 * 60_000);
  await p3.getByText('Сегодня, 18 ноября').waitFor({ timeout: 5000 });
  await p3.locator('textarea').fill('あたらしい ひです。');
  await p3.getByRole('button', { name: 'Сохранить' }).click();
  const d3 = (await st(p3)).diary;
  ok(d3['2026-11-18'] === 'あたらしい ひです。' && !d3['2026-11-17'], 'дневник после полуночи пишет в новый день');
  await ctx3.close();

  // плашка «Вышла новая версия»: меняем sw.js — браузер находит новую версию
  const swPath = path.join(__dirname, '../../dist/sw.js');
  const orig = fs.readFileSync(swPath, 'utf8');
  const ctx2 = await b.newContext();
  const p2 = await ctx2.newPage();
  try {
    await p2.goto(APP);
    await p2.evaluate(() => navigator.serviceWorker.ready);
    await p2.reload();
    ok(await p2.evaluate(() => !!navigator.serviceWorker.controller), 'service worker управляет страницей');
    ok(!(await p2.locator('.update-banner').isVisible()), 'без обновления плашки нет');
    fs.writeFileSync(swPath, orig + '\n// новая версия ' + Date.now());
    await p2.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await p2.locator('.update-banner').waitFor({ timeout: 10000 });
    ok(true, 'новая версия → плашка «Обновить»');
  } finally {
    fs.writeFileSync(swPath, orig);
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
