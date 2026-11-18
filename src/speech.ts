// Японский голос из системы (Windows, Android, macOS/iOS) — работает без интернета, если голос установлен.

let cached: SpeechSynthesisVoice | null | undefined;

function pick(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const ja = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'));
  // локальные голоса не требуют интернета — их в приоритет
  return ja.find((v) => v.localService) ?? ja[0] ?? null;
}

/** Есть ли японский голос. Список голосов в браузере иногда загружается не сразу — ждём до 1,5 с. */
export function findJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!('speechSynthesis' in window)) return Promise.resolve((cached = null));
  const now = pick();
  if (now) return Promise.resolve((cached = now));
  return new Promise((resolve) => {
    const done = () => {
      const v = pick();
      if (v || timedOut) {
        cached = v;
        resolve(v);
      }
    };
    let timedOut = false;
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(() => {
      timedOut = true;
      done();
    }, 1500);
  });
}

export function speak(text: string, rate = 0.8): void {
  const v = cached;
  if (!v) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = v.lang;
  u.rate = rate;
  try {
    u.voice = v;
  } catch {
    /* браузер не принял голос — хватит языка ja-JP */
  }
  speechSynthesis.speak(u);
}

export const VOICE_HELP =
  'Нет японского голоса. Windows: «Параметры» → «Время и язык» → «Речь» → «Добавить голоса» → японский. ' +
  'Android: «Настройки» → «Синтез речи» → Google → установить японский. После установки перезапусти браузер.';
