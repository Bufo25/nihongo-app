// Японский голос из системы (Windows, Android, macOS/iOS) — работает без интернета, если голос установлен.
// Chrome на Android капризен: список голосов бывает пустым, хотя японский голос есть; фраза, отправленная
// сразу после cancel(), может молча пропасть; объект фразы может быть собран мусорщиком посреди речи.

let cached: SpeechSynthesisVoice | null | undefined;
let current: SpeechSynthesisUtterance | null = null; // держим ссылку, пока фраза звучит

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function japaneseVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'));
}

function pick(): SpeechSynthesisVoice | null {
  const ja = japaneseVoices();
  // локальные голоса не требуют интернета — их в приоритет
  return ja.find((v) => v.localService) ?? ja[0] ?? null;
}

/** Есть ли японский голос в списке. Список голосов иногда загружается не сразу — ждём до 1,5 с. */
export function findJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cached) return Promise.resolve(cached);
  if (!speechSupported()) return Promise.resolve((cached = null));
  const now = pick();
  if (now) return Promise.resolve((cached = now));
  return new Promise((resolve) => {
    let finished = false;
    const done = (final: boolean) => {
      if (finished) return;
      const v = pick();
      if (v || final) {
        finished = true;
        cached = v;
        resolve(v);
      }
    };
    speechSynthesis.addEventListener('voiceschanged', () => done(false));
    setTimeout(() => done(true), 1500);
  });
}

function utter(text: string, rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  // язык задаём всегда: если голос в списке не нашёлся, система выберет японский сама
  u.lang = cached?.lang ?? 'ja-JP';
  u.rate = rate;
  if (cached) {
    try {
      u.voice = cached;
    } catch {
      /* браузер не принял голос — хватит языка */
    }
  }
  u.onend = () => {
    if (current === u) current = null;
  };
  return u;
}

/** Произнести. Работает и без найденного голоса — по языку ja-JP (на Android это часто единственный путь). */
export function speak(text: string, rate = 0.8): SpeechSynthesisUtterance | null {
  if (!speechSupported()) return null;
  const synth = window.speechSynthesis;
  const u = utter(text, rate);
  current = u;
  const go = () => {
    synth.speak(u);
    if (synth.paused) synth.resume();
  };
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(go, 120); // сразу после cancel() Chrome может проглотить фразу
  } else go();
  return u;
}

export interface VoiceCheck {
  ok: boolean;
  lines: string[];
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'браузер не разрешил говорить без нажатия — нажми «Проверить голос» ещё раз',
  'language-unavailable': 'в системе нет японского языка для синтеза речи',
  'voice-unavailable': 'выбранный японский голос недоступен',
  'synthesis-unavailable': 'синтез речи в системе недоступен',
  'synthesis-failed': 'синтез речи не сработал',
  'audio-busy': 'звук занят другим приложением',
  'audio-hardware': 'проблема со звуком устройства',
  network: 'японский голос — онлайновый, а сети нет',
};

/** Проверка: сказать «こんにちは» и сообщить, что произошло. Вызывать по нажатию кнопки. */
export async function checkVoice(): Promise<VoiceCheck> {
  if (!speechSupported()) return { ok: false, lines: ['Этот браузер не умеет синтез речи.'] };
  await findJapaneseVoice();
  const all = window.speechSynthesis.getVoices();
  const ja = japaneseVoices();
  const lines = [
    `Голосов в системе: ${all.length}, японских: ${ja.length}${ja.length ? ` (${ja.map((v) => v.name + (v.localService ? '' : ', онлайн')).join('; ')})` : ''}.`,
  ];
  const u = speak('こんにちは', 0.9);
  if (!u) return { ok: false, lines: [...lines, 'Не удалось отправить фразу.'] };
  const outcome = await new Promise<string>((resolve) => {
    const t = setTimeout(() => resolve('timeout'), 5000);
    u.addEventListener('start', () => {
      clearTimeout(t);
      resolve('start');
    });
    u.addEventListener('error', (e) => {
      clearTimeout(t);
      resolve('error:' + ((e as SpeechSynthesisErrorEvent).error ?? '?'));
    });
  });
  if (outcome === 'start') {
    return {
      ok: true,
      lines: [...lines, 'Браузер начал говорить «こんにちは». Если ничего не слышно — прибавь громкость мультимедиа (не звонка) и проверь беззвучный режим.'],
    };
  }
  if (outcome === 'timeout') {
    return { ok: false, lines: [...lines, 'Браузер принял фразу, но так и не начал говорить за 5 секунд.', VOICE_HELP] };
  }
  const code = outcome.slice(6);
  return { ok: false, lines: [...lines, `Ошибка: ${ERRORS[code] ?? code}.`, ...(code === 'not-allowed' ? [] : [VOICE_HELP])] };
}

export const VOICE_HELP =
  'Как добавить японский голос. Android: «Настройки» → поиск «Синтез речи» (или «Преобразование текста в речь») → ' +
  'движок Google → значок настроек → «Установить голосовые данные» → японский; громкость — мультимедиа. ' +
  'Windows: «Параметры» → «Время и язык» → «Речь» → «Добавить голоса» → японский. После установки перезапусти браузер.';
