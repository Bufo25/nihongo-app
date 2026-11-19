import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { update } from '../store.ts';
import type { State } from '../logic.ts';
import {
  fmtTime, hasJapanese, lineAt, parseAny, startFrom, tokenize, translateLinks, videoIdFrom, wordsTsv,
  type Line, type ReaderText, type SavedWord,
} from '../reader.ts';
import { findJapaneseVoice, speak } from '../speech.ts';
import { Header, Icon } from '../ui.tsx';

/** #/reader — список; #/reader/<id> — чтение; #/reader/words — мои слова. */
export function Reader({ s, param }: { s: State; param: string | null }) {
  if (param === 'words') return <Words s={s} />;
  if (param && s.texts[param]) return <ReaderView key={param} s={s} text={s.texts[param]} />;
  return <ReaderList s={s} missing={!!param} />;
}

// ---------- список и создание ----------

function ReaderList({ s, missing }: { s: State; missing: boolean }) {
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState('');
  const vid = videoIdFrom(link);
  const texts = Object.values(s.texts).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const wordsCount = Object.keys(s.savedWords).length;

  const create = () => {
    setErr('');
    const lines = parseAny(raw);
    if (!lines.length) return setErr('Не нашёл в тексте ни одной фразы.');
    if (!lines.some((l) => hasJapanese(l.text)) && !confirm('В тексте нет японского. Точно выбраны японские субтитры? Создать всё равно?')) return;
    if (link.trim() && !vid) return setErr('Не понял ссылку на видео. Нужна ссылка YouTube вида youtube.com/watch?v=… или youtu.be/…');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const t: ReaderText = {
      id,
      title: title.trim() || (vid ? `Видео ${vid}` : lines[0].text.slice(0, 30)),
      videoId: vid,
      lines,
      createdAt: new Date().toISOString(),
    };
    update((st) => {
      st.texts[id] = t;
      const start = startFrom(link);
      if (start) st.readerPos[id] = Math.max(0, lineAt(lines, start));
    });
    location.hash = `#/reader/${id}`;
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setRaw(await f.text());
    if (!title) setTitle(f.name.replace(/\.(srt|vtt|ass|ssa|txt)$/i, ''));
  };

  return (
    <div class="page">
      <Header title="Читалка" sub="Видео с YouTube или субтитры → текст, по которому можно читать и нажимать на слова" />
      {missing && <div class="banner">Этого текста нет на устройстве — возможно, его удалили на другом.</div>}

      <section class="card">
        <h2>Новая читалка</h2>
        <label class="field">
          <span>1. Ссылка на видео YouTube (если есть)</span>
          <input
            class="text-input"
            value={link}
            placeholder="https://www.youtube.com/watch?v=…"
            inputMode="url"
            autocomplete="off"
            onInput={(e) => setLink((e.target as HTMLInputElement).value)}
          />
        </label>
        {vid && (
          <p class="small-text">
            <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer">
              Открыть видео на YouTube <Icon name="ext" size={14} />
            </a>{' '}
            — и скопировать расшифровку:
          </p>
        )}
        <details class="howto" open={!!vid}>
          <summary class="small-text">Как скопировать расшифровку с YouTube</summary>
          <ol class="plain small-text">
            <li>
              Под видео нажми <b>«…ещё»</b> в описании → <b>«Показать расшифровку»</b> (на ПК — справа от видео появится список фраз).
            </li>
            <li>
              Вверху расшифровки выбери язык <b>японский</b> (если есть выбор — лучше не «автоматически созданные»).
            </li>
            <li>Выдели весь список мышью от первой фразы до последней и скопируй (Ctrl+C).</li>
            <li>Вставь ниже. Время фраз приложение поймёт само.</li>
          </ol>
          <p class="muted small-text">
            На телефоне расшифровка в приложении YouTube открывается, но выделить её целиком почти невозможно — удобнее сделать это на ПК: читалка
            синхронизируется на телефон.
          </p>
        </details>
        <label class="field">
          <span>2. Текст расшифровки — или файл субтитров (.srt, .ass, .vtt с Jimaku)</span>
          <textarea
            rows={6}
            lang="ja"
            value={raw}
            placeholder={'0:00\nこんにちは、みなさん。\n0:03\nきょうは…'}
            onInput={(e) => setRaw((e.target as HTMLTextAreaElement).value)}
          />
        </label>
        <input type="file" accept=".srt,.vtt,.ass,.ssa,.txt,text/plain" onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
        <label class="field">
          <span>Название (необязательно)</span>
          <input class="text-input" value={title} placeholder="Например: Фубуки, стрим 12.11" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </label>
        <div class="row">
          <button class="btn primary" disabled={!raw.trim()} onClick={create}>
            Сделать читалку
          </button>
          {raw.trim() && <span class="muted small-text">{parseAny(raw).length} фраз</span>}
        </div>
        {err && <p class="error-text small-text">{err}</p>}
      </section>

      <a class="card link-card" href="#/reader/words">
        <div>
          <h2>Мои слова</h2>
          <p class="muted">{wordsCount ? `${wordsCount} — выгрузить в Anki` : 'Сохраняй слова из текстов, потом выгрузи в Anki'}</p>
        </div>
        <Icon name="chev" />
      </a>

      {texts.length > 0 && (
        <section>
          <h2 class="section-title">Тексты</h2>
          <ul class="res-list card">
            {texts.map((t) => {
              const pos = s.readerPos[t.id] ?? 0;
              return (
                <li class="text-row">
                  <a href={`#/reader/${t.id}`}>
                    <span>
                      <b>{t.title}</b>
                      <span class="muted small-text">
                        {t.videoId ? 'видео · ' : ''}
                        {t.lines.length} фраз{pos > 0 ? ` · остановился на ${pos + 1}` : ''}
                      </span>
                    </span>
                    <Icon name="chev" size={18} />
                  </a>
                  <button
                    class="linklike small-text"
                    aria-label={`Удалить «${t.title}»`}
                    onClick={() =>
                      confirm(`Удалить «${t.title}»? Сохранённые слова останутся.`) &&
                      update((st) => {
                        delete st.texts[t.id];
                        delete st.readerPos[t.id];
                      })
                    }
                  >
                    удалить
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- плеер YouTube ----------

interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(s: number, allow: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  setPlaybackRate(r: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, o: unknown) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytLoading: Promise<NonNullable<Window['YT']>> | null = null;
function loadYT(): Promise<NonNullable<Window['YT']>> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytLoading ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    sc.onerror = () => {
      ytLoading = null;
      reject(new Error('YouTube недоступен'));
    };
    document.head.appendChild(sc);
  });
  return ytLoading;
}

// ---------- чтение ----------

interface Picked {
  word: string;
  line: number;
}

function ReaderView({ s, text }: { s: State; text: ReaderText }) {
  const [cur, setCur] = useState(s.readerPos[text.id] ?? 0);
  const [follow, setFollow] = useState(true);
  const [pauseEach, setPauseEach] = useState(false);
  const [rate, setRate] = useState(1);
  const [video, setVideo] = useState<'loading' | 'ready' | 'error'>(text.videoId ? 'loading' : 'error');
  const [picked, setPicked] = useState<Picked | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const lastIdx = useRef(cur); // на какой фразе плеер был при прошлой проверке
  const live = useRef({ cur, follow, pauseEach });
  live.current = { cur, follow, pauseEach };
  const lines = text.lines;
  const timed = lines.some((l) => l.t !== null);

  // запомнить, где остановился (не чаще раза в 3 секунды — это синхронизируется)
  const savedPos = useRef(cur);
  useEffect(() => {
    const t = setTimeout(() => {
      if (savedPos.current !== cur) {
        savedPos.current = cur;
        update((st) => (st.readerPos[text.id] = cur));
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [cur]);

  // плеер
  useEffect(() => {
    if (!text.videoId || !holder.current) return;
    let tick: ReturnType<typeof setInterval> | undefined;
    let alive = true;
    const failTimer = setTimeout(() => alive && !player.current && setVideo('error'), 15000);
    loadYT()
      .then((YT) => {
        if (!alive || !holder.current) return;
        const startLine = lines[live.current.cur];
        // YouTube заменяет переданный элемент на iframe — даём ему свой, не управляемый Preact
        const el = document.createElement('div');
        holder.current.replaceChildren(el);
        player.current = new YT.Player(el, {
          videoId: text.videoId,
          playerVars: { playsinline: 1, rel: 0, start: Math.floor(startLine?.t ?? 0) },
          events: {
            onReady: () => {
              clearTimeout(failTimer);
              setVideo('ready');
            },
            onError: () => setVideo('error'),
          },
        });
        lastIdx.current = live.current.cur;
        tick = setInterval(() => {
          const p = player.current;
          if (!p?.getCurrentTime || p.getPlayerState?.() !== YT.PlayerState.PLAYING) return;
          const idx = lineAt(lines, p.getCurrentTime());
          if (idx < 0 || idx === lastIdx.current) return;
          // «пауза после фразы»: дошли до следующей — стоп, чтобы повторить вслух
          if (live.current.pauseEach && idx === lastIdx.current + 1) p.pauseVideo();
          lastIdx.current = idx;
          setCur(idx);
        }, 100);
      })
      .catch(() => alive && setVideo('error'));
    return () => {
      alive = false;
      clearTimeout(failTimer);
      clearInterval(tick);
      player.current?.destroy?.();
      player.current = null;
    };
  }, [text.id]);

  // прокрутка к текущей фразе
  useEffect(() => {
    if (!live.current.follow) return;
    const el = listRef.current?.children[cur] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cur]);

  useEffect(() => {
    findJapaneseVoice();
  }, []);

  const playLine = (i: number) => {
    setCur(i);
    lastIdx.current = i;
    const l = lines[i];
    if (player.current && video === 'ready' && l.t !== null) {
      player.current.seekTo(l.t, true);
      player.current.playVideo();
    } else speak(l.text, 0.9);
  };

  return (
    <div class="page reader-page">
      <div class="reader-top">
        <a class="small-text" href="#/reader">
          ← Читалка
        </a>
        <h1 class="reader-title">{text.title}</h1>
      </div>

      {text.videoId && (
        <div class="video-wrap">
          <div class="video-box">
            <div ref={holder} />
            {video === 'loading' && <div class="video-msg">Загружаю видео…</div>}
          </div>
          {video === 'error' && (
            <p class="banner small-text">
              Видео не загрузилось. Если YouTube у тебя открывается только через VPN — включи его и открой текст заново. Читать и слушать фразы
              голосом можно и без видео.
            </p>
          )}
        </div>
      )}

      <div class="reader-controls">
        {video === 'ready' && timed && (
          <>
            <label class="toggle">
              <input type="checkbox" checked={pauseEach} onChange={() => setPauseEach(!pauseEach)} />
              Пауза после фразы
            </label>
            <label class="toggle">
              <input type="checkbox" checked={follow} onChange={() => setFollow(!follow)} />
              Следить за видео
            </label>
            <select
              aria-label="Скорость видео"
              value={rate}
              onChange={(e) => {
                const r = Number((e.target as HTMLSelectElement).value);
                setRate(r);
                player.current?.setPlaybackRate(r);
              }}
            >
              {[0.5, 0.75, 1, 1.25].map((r) => (
                <option value={r}>{r}×</option>
              ))}
            </select>
          </>
        )}
        <span class="muted small-text">Нажми на слово — перевод и «в мои слова»</span>
      </div>

      <ol class="reader-lines" ref={listRef}>
        {lines.map((l, i) => (
          <ReaderLine line={l} i={i} current={i === cur} onPlay={() => playLine(i)} onWord={(w) => setPicked({ word: w, line: i })} />
        ))}
      </ol>

      {picked && (
        <WordSheet
          s={s}
          picked={picked}
          sentence={lines[picked.line].text}
          source={text.title}
          onReplay={() => playLine(picked.line)}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

function ReaderLine({ line, i, current, onPlay, onWord }: { line: Line; i: number; current: boolean; onPlay: () => void; onWord: (w: string) => void }) {
  const toks = useMemo(() => tokenize(line.text), [line.text]);
  return (
    <li class={`rline ${current ? 'current' : ''}`} data-i={i}>
      <button class="rline-play" onClick={onPlay} aria-label={line.t !== null ? `С ${fmtTime(line.t)}` : 'Произнести фразу'}>
        {line.t !== null ? fmtTime(line.t) : '🔊'}
      </button>
      <p class="rline-text ja" lang="ja">
        {toks.map((t) =>
          t.word ? (
            <span class="tok" role="button" tabIndex={0} onClick={() => onWord(t.text)} onKeyDown={(e) => e.key === 'Enter' && onWord(t.text)}>
              {t.text}
            </span>
          ) : (
            t.text
          ),
        )}
      </p>
    </li>
  );
}

function WordSheet({
  s, picked, sentence, source, onReplay, onClose,
}: {
  s: State;
  picked: Picked;
  sentence: string;
  source: string;
  onReplay: () => void;
  onClose: () => void;
}) {
  const saved = !!s.savedWords[picked.word];
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    speak(picked.word, 0.85);
    setCopied(false);
  }, [picked.word, picked.line]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div class="sheet" role="dialog" aria-label={`Слово ${picked.word}`}>
      <div class="sheet-head">
        <span class="sheet-word ja" lang="ja">
          {picked.word}
        </span>
        <button class="icon-btn" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>
      <div class="sheet-actions">
        <button class="btn small" onClick={() => speak(picked.word, 0.8)}>
          🔊 Слово
        </button>
        <button
          class={`btn small ${saved ? '' : 'primary'}`}
          onClick={() =>
            update((st) => {
              if (st.savedWords[picked.word]) delete st.savedWords[picked.word];
              else st.savedWords[picked.word] = { word: picked.word, sentence, source, at: new Date().toISOString() } satisfies SavedWord;
            })
          }
        >
          {saved ? '✓ В моих словах' : '★ В мои слова'}
        </button>
        <button
          class="btn small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(picked.word);
              setCopied(true);
            } catch {
              /* нет доступа к буферу */
            }
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <p class="sheet-links small-text">
        Перевод слова:{' '}
        {translateLinks(picked.word).map((l, i) => (
          <>
            {i > 0 && ' · '}
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.name}
            </a>
          </>
        ))}
      </p>
      <div class="sheet-sentence">
        <p class="ja" lang="ja">
          {sentence}
        </p>
        <p class="small-text">
          <button class="linklike" onClick={onReplay}>
            повторить фразу
          </button>{' '}
          · перевод фразы:{' '}
          {translateLinks(sentence).map((l, i) => (
            <>
              {i > 0 && ' · '}
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.name.split(' ')[0]}
              </a>
            </>
          ))}
        </p>
      </div>
    </div>
  );
}

// ---------- мои слова ----------

function Words({ s }: { s: State }) {
  const words = Object.values(s.savedWords).sort((a, b) => (a.at < b.at ? 1 : -1));
  const download = () => {
    const blob = new Blob([wordsTsv(words)], { type: 'text/tab-separated-values;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `мои-слова-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div class="page">
      <a class="small-text" href="#/reader">
        ← Читалка
      </a>
      <Header title="Мои слова" sub={`${words.length} — сохранены из текстов, вместе с фразой`} />
      {words.length > 0 ? (
        <>
          <section class="card">
            <button class="btn primary" onClick={download}>
              Скачать для Anki
            </button>
            <details class="howto">
              <summary class="small-text">Как загрузить в Anki</summary>
              <ol class="plain small-text">
                <li>В Anki: «Файл» → «Импорт» → выбери скачанный файл.</li>
                <li>Разделитель полей — табуляция. Тип записи «Основная»: поле 1 → «Лицевая сторона» (слово), поле 2 → «Оборотная» (фраза), поле 3 — в теги или пропустить.</li>
                <li>Колоду выбери отдельную, например «Слова из видео», — чтобы не смешивать с KaishiRu.</li>
              </ol>
            </details>
          </section>
          <ul class="res-list card">
            {words.map((w) => (
              <li class="word-row">
                <div>
                  <span>
                    <b class="ja" lang="ja">
                      {w.word}
                    </b>
                    <span class="muted small-text ja" lang="ja">
                      {w.sentence}
                    </span>
                    <span class="muted small-text">{w.source}</span>
                  </span>
                  <button class="icon-btn" aria-label={`Произнести ${w.word}`} onClick={() => speak(w.word, 0.8)}>
                    🔊
                  </button>
                  <button class="linklike small-text" onClick={() => update((st) => delete st.savedWords[w.word])} aria-label={`Удалить ${w.word}`}>
                    удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p class="muted">Пока пусто. Открой текст в читалке, нажми на слово и «★ В мои слова».</p>
      )}
    </div>
  );
}
