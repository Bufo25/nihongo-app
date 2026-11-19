import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { update } from '../store.ts';
import type { State } from '../logic.ts';
import {
  fmtTime, hasJapanese, lineAt, parseAny, startFrom, tokenize, translateLinks, videoIdFrom, wordsTsv,
  type Line, type ReaderText, type SavedWord,
} from '../reader.ts';
import { findJapaneseVoice, speak } from '../speech.ts';
import { ensureDict, posRu, useDict, type Dictionary } from '../dict.ts';
import { isKana, readingOf, toCyrillic, toLatin } from '../transcribe.ts';
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

// ---------- подписи над словами ----------

type Ruby = 'none' | 'kana' | 'cyr' | 'lat';
const RUBY_KEY = 'nihongo-reader-ruby';
const loadRuby = (): Ruby => {
  try {
    return (localStorage.getItem(RUBY_KEY) as Ruby) || 'none';
  } catch {
    return 'none';
  }
};

/** Чтение каной для слова в тексте: само слово, если оно на кане, иначе — по словарю. */
function tokenReading(dict: Dictionary | null, lineText: string, at: number, tok: string): string | null {
  // частицы は и へ читаются «ва» и «э»; так же в приветствиях
  if (tok === 'は') return 'わ';
  if (tok === 'へ') return 'え';
  if (/^(こんにち|こんばん)は$/.test(tok)) return tok.slice(0, -1) + 'わ';
  if (isKana(tok)) return tok;
  if (!dict) return null;
  const r = dict.lookup(lineText.slice(at), tok.length);
  if (!r) return null;
  const m = r.matches[0];
  const baseReading = isKana(m.base) ? m.base : m.entry.kana[0];
  const head = readingOf(tok.slice(0, r.length), m.base, baseReading);
  if (head === null) return null;
  const rest = tok.slice(r.length);
  if (!rest) return head;
  return isKana(rest) ? head + rest : null;
}

/** Транскрипция чтения: кириллица, латиница или сама кана. */
function transcribe(reading: string, mode: Exclude<Ruby, 'none'>): string | null {
  if (mode === 'kana') return reading;
  return mode === 'cyr' ? toCyrillic(reading) : toLatin(reading);
}

// ---------- чтение ----------

interface Picked {
  word: string; // слово, на которое нажали (как его выделил браузер)
  line: number;
  offset: number; // где это слово начинается во фразе — словарь ищет от этого места
}

function ReaderView({ s, text }: { s: State; text: ReaderText }) {
  const [cur, setCur] = useState(s.readerPos[text.id] ?? 0);
  const [follow, setFollow] = useState(true);
  const [pauseEach, setPauseEach] = useState(false);
  const [rate, setRate] = useState(1);
  const [video, setVideo] = useState<'loading' | 'ready' | 'error'>(text.videoId ? 'loading' : 'error');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [ruby, setRubyRaw] = useState<Ruby>(loadRuby);
  const setRuby = (r: Ruby) => {
    setRubyRaw(r);
    try {
      localStorage.setItem(RUBY_KEY, r);
    } catch {
      /* ignore */
    }
  };
  const ds = useDict();
  const dict = ds.state === 'ready' ? ds.dict : null;
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
        <select aria-label="Подписи над словами" value={ruby} onChange={(e) => setRuby((e.target as HTMLSelectElement).value as Ruby)}>
          <option value="none">Без подписей</option>
          <option value="kana">Подписи: кана</option>
          <option value="cyr">Подписи: кириллица</option>
          <option value="lat">Подписи: латиница</option>
        </select>
        <DictBadge />
      </div>

      <ol class="reader-lines" ref={listRef}>
        {lines.map((l, i) => (
          <ReaderLine
            line={l}
            i={i}
            current={i === cur}
            ruby={ruby}
            dict={dict}
            onPlay={() => playLine(i)}
            onWord={(w, off) => setPicked({ word: w, line: i, offset: off })}
          />
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

function ReaderLine({
  line, i, current, ruby, dict, onPlay, onWord,
}: {
  line: Line;
  i: number;
  current: boolean;
  ruby: Ruby;
  dict: Dictionary | null;
  onPlay: () => void;
  onWord: (w: string, offset: number) => void;
}) {
  const toks = useMemo(() => {
    let off = 0;
    return tokenize(line.text).map((t) => {
      const at = off;
      off += t.text.length;
      let ann: string | null = null;
      if (ruby !== 'none' && t.word && !(ruby === 'kana' && isKana(t.text))) {
        const r = tokenReading(dict, line.text, at, t.text);
        ann = r ? transcribe(r, ruby) : null;
      }
      return { ...t, at, ann };
    });
  }, [line.text, ruby, dict]);
  return (
    <li class={`rline ${current ? 'current' : ''}`} data-i={i}>
      <button class="rline-play" onClick={onPlay} aria-label={line.t !== null ? `С ${fmtTime(line.t)}` : 'Произнести фразу'}>
        {line.t !== null ? fmtTime(line.t) : '🔊'}
      </button>
      <p class={`rline-text ja ${ruby !== 'none' ? 'with-ruby' : ''}`} lang="ja">
        {toks.map((t) =>
          t.word ? (
            <span class="tok" role="button" tabIndex={0} onClick={() => onWord(t.text, t.at)} onKeyDown={(e) => e.key === 'Enter' && onWord(t.text, t.at)}>
              {t.ann ? (
                <ruby>
                  {t.text}
                  <rt class={ruby === 'kana' ? '' : 'rt-latin'} lang={ruby === 'kana' ? 'ja' : ruby === 'cyr' ? 'ru' : 'en'}>
                    {t.ann}
                  </rt>
                </ruby>
              ) : (
                t.text
              )}
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
  const ds = useDict();
  const found = ds.state === 'ready' ? ds.dict.lookup(sentence.slice(picked.offset)) : null;
  // словарь мог найти слово длиннее, чем выделил браузер (食べ|まし|た → 食べました)
  const surface = found ? sentence.slice(picked.offset, picked.offset + found.length) : picked.word;
  const top = found?.matches[0];
  const head = top ? top.entry.kanji[0] ?? top.entry.kana[0] : surface;
  const reading = top && top.entry.kanji.length ? top.entry.kana[0] : '';
  const meaning = top ? top.entry.senses.slice(0, 2).map((x) => x.text).join('; ') : '';
  // чтение того, что в тексте: по словарю или сама кана
  const surfReading = top ? readingOf(surface, top.base, isKana(top.base) ? top.base : top.entry.kana[0]) : isKana(surface) ? surface : null;
  const headReading = reading || (isKana(head) ? head : '');
  const cyr = headReading ? toCyrillic(headReading) : null;
  const saved = !!s.savedWords[head];
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    speak(top?.base && top.reasons.length ? top.base : surface, 0.85);
    setCopied(false);
    setMore(false);
  }, [picked.word, picked.line, picked.offset, ds.state]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const shown = found ? (more ? found.matches : found.matches.slice(0, 2)) : [];
  return (
    <div class="sheet" role="dialog" aria-label={`Слово ${surface}`}>
      <div class="sheet-head">
        <span class="sheet-word ja" lang="ja">
          {surface}
        </span>
        <button class="icon-btn" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>
      {surfReading && (
        <p class="transcr">
          {surfReading !== surface && (
            <span class="ja" lang="ja">
              {surfReading}
            </span>
          )}
          <span>{toCyrillic(surfReading)}</span>
          <span class="muted">{toLatin(surfReading)}</span>
        </p>
      )}

      <div class="dict-results">
        {ds.state === 'loading' && (
          <p class="muted small-text">
            Загружаю словарь… {(ds.loaded / 1e6).toFixed(1)} из {(ds.total / 1e6).toFixed(1)} МБ (один раз, потом работает без интернета)
          </p>
        )}
        {ds.state === 'error' && (
          <p class="small-text">
            <span class="error-text">Словарь не загрузился: {ds.message}.</span>{' '}
            <button class="linklike" onClick={() => ensureDict()}>
              повторить
            </button>
          </p>
        )}
        {ds.state === 'missing' && <p class="muted small-text">В этой версии приложения словаря нет.</p>}
        {ds.state === 'ready' && !found && <p class="muted small-text">В словаре не нашлось — попробуй переводчик ниже.</p>}
        {shown.map((m) => (
          <div class="dict-entry">
            <div class="dict-head">
              <b class="ja" lang="ja">
                {m.entry.kanji[0] ?? m.entry.kana[0]}
              </b>
              {m.entry.kanji.length > 0 && (
                <span class="ja dict-reading" lang="ja">
                  {m.entry.kana.join('、')}
                </span>
              )}
              {m.entry.common && <span class="pill ok">частое</span>}
              {m.entry.english && <span class="pill">англ.</span>}
            </div>
            {m.reasons.length > 0 && (
              <p class="dict-form small-text">
                <span class="ja" lang="ja">
                  {surface}
                </span>{' '}
                ← <span class="ja" lang="ja">{m.base}</span>: {m.reasons.join(' → ')}
              </p>
            )}
            <ol class="dict-senses">
              {m.entry.senses.map((x) => (
                <li>
                  {posRu(x.pos) && <span class="muted small-text">{posRu(x.pos)} </span>}
                  {x.text}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {found && found.matches.length > 2 && !more && (
          <button class="linklike small-text" onClick={() => setMore(true)}>
            ещё {found.matches.length - 2}
          </button>
        )}
      </div>

      <div class="sheet-actions">
        <button class="btn small" onClick={() => speak(top?.base ?? surface, 0.8)}>
          🔊 Слово
        </button>
        <button
          class={`btn small ${saved ? '' : 'primary'}`}
          onClick={() =>
            update((st) => {
              if (st.savedWords[head]) delete st.savedWords[head];
              else
                st.savedWords[head] = {
                  word: head,
                  reading: headReading && headReading !== head ? headReading : '',
                  cyr: cyr ?? '',
                  meaning,
                  sentence,
                  source,
                  at: new Date().toISOString(),
                } satisfies SavedWord;
            })
          }
        >
          {saved ? '✓ В моих словах' : '★ В мои слова'}
        </button>
        <button
          class="btn small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(head);
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
        Переводчик:{' '}
        {translateLinks(head).map((l, i) => (
          <>
            {i > 0 && ' · '}
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.name.split(' ')[0]}
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
      {ds.state === 'ready' && <p class="dict-credit">Словарь JMdict © EDRDG, CC BY-SA 4.0</p>}
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
                <li>Разделитель полей — табуляция, отметь «Разрешить HTML». Тип записи «Основная»: поле 1 → «Лицевая сторона» (слово), поле 2 → «Оборотная» (чтение, значение и фраза), поле 3 — в теги или пропустить.</li>
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
                      {w.reading && <span class="dict-reading"> {w.reading}</span>}
                      {w.cyr && <span class="dict-reading"> [{w.cyr}]</span>}
                    </b>
                    {w.meaning && <span class="small-text">{w.meaning}</span>}
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

function DictBadge() {
  const ds = useDict();
  return (
    <span class="muted small-text">
      {ds.state === 'loading'
        ? `Загружаю словарь… ${Math.round((ds.loaded / Math.max(ds.total, 1)) * 100)}%`
        : ds.state === 'ready'
          ? 'Нажми на слово — значение из словаря'
          : 'Нажми на слово — перевод и «в мои слова»'}
    </span>
  );
}
