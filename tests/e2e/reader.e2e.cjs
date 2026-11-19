// Читалка: ссылка + расшифровка → текст с видео; слова → «мои слова» → файл для Anki.
const { chromium } = require('playwright');
const fs = require('fs');
const APP = process.env.APP_URL || 'http://localhost:4173/';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

// Поддельный YouTube IFrame API: управляем «временем» видео из теста
const FAKE_YT = `
window.__ytLog = [];
window.YT = {
  PlayerState: { PLAYING: 1 },
  Player: class {
    constructor(el, o) {
      this.t = o.playerVars.start || 0; this.state = -1; window.__yt = this; window.__ytVideo = o.videoId;
      const f = document.createElement('iframe'); el.replaceWith(f);
      setTimeout(() => o.events.onReady({ target: this }), 30);
    }
    getCurrentTime() { return this.t; }
    getPlayerState() { return this.state; }
    seekTo(t) { this.t = t; window.__ytLog.push('seek:' + t); }
    playVideo() { this.state = 1; window.__ytLog.push('play'); }
    pauseVideo() { this.state = 2; window.__ytLog.push('pause'); }
    setPlaybackRate(r) { window.__ytLog.push('rate:' + r); }
    destroy() {}
  },
};
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;

const TRANSCRIPT = `0:00
みなさん、こんにちは。
0:03
きょうは ねこの はなしを します。
0:07
ねこは とても かわいいです。
0:12
では、また あした。`;

const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('nihongo-v1')));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
  await ctx.addInitScript(() => {
    window.__spoken = [];
    speechSynthesis.getVoices = () => [];
    speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await p.goto(APP);
  await p.getByRole('button', { name: 'Поехали' }).click();
  await p.goto(APP + '#/reader');
  await p.getByPlaceholder('https://www.youtube.com/watch?v=…').fill('https://youtu.be/dQw4w9WgXcQ?t=8');
  ok(await p.getByRole('link', { name: /Открыть видео на YouTube/ }).isVisible(), 'по ссылке — кнопка открыть видео и инструкция');
  await p.locator('textarea').fill(TRANSCRIPT);
  ok(await p.getByText('4 фраз').isVisible(), 'расшифровка распознана: 4 фразы');
  await p.getByPlaceholder(/Например/).fill('Про кошек');
  await p.getByRole('button', { name: 'Сделать читалку' }).click();
  await p.waitForURL(/#\/reader\/\w+/);
  await p.locator('.rline').first().waitFor();
  ok((await p.locator('.rline').count()) === 4, 'читалка: 4 фразы');
  await p.waitForFunction(() => window.__ytVideo === 'dQw4w9WgXcQ');
  ok((await p.locator('.rline.current .rline-play').textContent()) === '0:07', 'ссылка с ?t=8 открывает на фразе 0:07');

  // нажатие на время фразы → перемотка и воспроизведение
  await p.locator('.video-msg').waitFor({ state: 'detached' });
  await p.locator('.rline-play', { hasText: '0:03' }).click();
  ok((await p.evaluate(() => window.__ytLog)).join(',').includes('seek:3,play'), 'нажатие на фразу перематывает видео');
  // видео идёт → подсвечивается текущая фраза
  await p.evaluate(() => (window.__yt.t = 12.5));
  await p.waitForFunction(() => document.querySelector('.rline.current .rline-play')?.textContent === '0:12');
  ok(true, 'во время воспроизведения подсвечивается текущая фраза');
  // пауза после фразы
  await p.getByLabel('Пауза после фразы').check();
  await p.locator('.rline-play', { hasText: '0:03' }).click();
  await p.evaluate(() => (window.__yt.t = 7.2));
  await p.waitForFunction(() => window.__ytLog[window.__ytLog.length - 1] === 'pause');
  ok(true, 'пауза после фразы: дошли до следующей — видео на паузе');
  await p.getByLabel('Скорость видео').selectOption('0.75');
  ok((await p.evaluate(() => window.__ytLog)).includes('rate:0.75'), 'скорость видео 0.75×');

  // слово → карточка → «в мои слова»
  const tok = p.locator('.rline').nth(2).locator('.tok').first();
  const word = await tok.textContent();
  await tok.click();
  await p.locator('.sheet').waitFor();
  ok((await p.locator('.sheet-word').textContent()) === word, 'нажатие на слово открывает карточку: ' + word);
  ok((await p.evaluate(() => window.__spoken)).includes(word), 'слово произносится');
  const links = await p.locator('.sheet-links a').evaluateAll((as) => as.map((a) => a.href));
  ok(links[0].includes('translate.yandex.ru') && links[0].includes(encodeURIComponent(word)), 'ссылка на перевод слова');
  await p.getByRole('button', { name: '★ В мои слова' }).click();
  ok(await p.getByRole('button', { name: '✓ В моих словах' }).isVisible(), 'слово сохранено');
  await p.getByRole('button', { name: 'Закрыть' }).click();

  // позиция запоминается
  await p.waitForTimeout(3500);
  const s1 = await st(p);
  const id = Object.keys(s1.texts)[0];
  ok(s1.readerPos[id] >= 1 && s1.savedWords[word].sentence.includes(word), 'позиция и слово с фразой записаны');

  // мои слова → файл для Anki
  await p.goto(APP + '#/reader/words');
  ok((await p.locator('.word-row').count()) === 1, 'в «Моих словах» 1 слово');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Скачать для Anki' }).click()]);
  const tsv = fs.readFileSync(await dl.path(), 'utf8');
  ok(tsv.startsWith(word + '\t') && tsv.includes('Про кошек'), 'файл для Anki: слово, фраза, источник');

  // файл субтитров без видео: фразы озвучиваются голосом
  await p.goto(APP + '#/reader');
  await p.locator('input[type=file]').setInputFiles({
    name: 'chi-01.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nチーです\n\n2\n00:00:03,000 --> 00:00:04,000\nおなかが すいた\n'),
  });
  await p.getByRole('button', { name: 'Сделать читалку' }).click();
  await p.waitForURL(/#\/reader\/\w+/);
  ok((await p.locator('.reader-title').textContent()) === 'chi-01', 'название — из имени файла');
  await p.locator('.rline-play').nth(1).click();
  ok((await p.evaluate(() => window.__spoken)).includes('おなかが すいた'), 'без видео нажатие на фразу её произносит');
  ok(errors.length === 0, 'нет ошибок в консоли ' + errors.join('; '));
  await ctx.close();

  // YouTube недоступен — понятное сообщение, текст работает
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.route('https://www.youtube.com/**', (r) => r.abort('failed'));
  const p2 = await ctx2.newPage();
  await p2.goto(APP);
  await p2.getByRole('button', { name: 'Поехали' }).click();
  await p2.goto(APP + '#/reader');
  await p2.getByPlaceholder('https://www.youtube.com/watch?v=…').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await p2.locator('textarea').fill(TRANSCRIPT);
  await p2.getByRole('button', { name: 'Сделать читалку' }).click();
  await p2.getByText(/Видео не загрузилось/).waitFor({ timeout: 5000 });
  ok((await p2.locator('.rline').count()) === 4, 'YouTube недоступен: сообщение, текст на месте');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
