import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { update } from '../store.ts';
import { dailyBlocks, ruleWeek, type State } from '../logic.ts';
import {
  MASTERED, ROWS, SAME_SOUND, applyAnswer, choicesFor, isCorrect, itemsFor, kanaChoicesFor, pickNext, toKata,
  type KanaItem, type Reading, type Script,
} from '../kana.ts';
import { isWordCorrect, wordItems, type WordItem } from '../kana-words.ts';
import { checkVoice, findJapaneseVoice, speak, speechSupported, type VoiceCheck } from '../speech.ts';
import { timerBlock } from '../timer.ts';
import { Header } from '../ui.tsx';
import { deviceDayKey } from '../device.ts';

/** read — знак → чтение; reverse — чтение → знак; audio — на слух → знак; words — слово → чтение */
type Drill = 'read' | 'reverse' | 'audio' | 'words';

interface Prefs {
  script: Script;
  rows: string[];
  mode: 'choice' | 'input';
  reading: Reading;
  length: number;
  drill: Drill;
}

const DRILLS: { id: Drill; title: string; hint: string }[] = [
  { id: 'read', title: 'Знак → чтение', hint: 'Видишь знак — называешь чтение' },
  { id: 'reverse', title: 'Чтение → знак', hint: 'Видишь чтение — находишь знак' },
  { id: 'audio', title: 'На слух', hint: 'Слышишь слог — находишь знак' },
  { id: 'words', title: 'Слова', hint: 'Читаешь короткие слова целиком — на скорость' },
];

const PREFS_KEY = 'nihongo-kana-prefs';

function loadPrefs(week: number): Prefs {
  const d: Prefs = { script: week === 3 ? 'kata' : 'hira', rows: ['a', 'ka', 'sa'], mode: 'choice', reading: 'cyr', length: 20, drill: week === 4 ? 'words' : 'read' };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return d;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

type Entry = KanaItem | WordItem;
const isWord = (e: Entry): e is WordItem => 'word' in e;

/** Вопрос в любом режиме. */
interface Q {
  key: string;
  kind: 'kana' | 'reading' | 'audio' | 'word';
  prompt: string;
  right: string;
  choices: string[] | null; // null — ввод с клавиатуры
  choicesAreKana: boolean;
  check: (a: string) => boolean;
  reveal: string;
  meaning?: string;
  say?: string; // что произнести
  label: string; // как показать в списке ошибок
}

function makeQ(e: Entry, pool: Entry[], p: Prefs): Q {
  const label = (x: { cyr: string; lat: string }) => (p.reading === 'cyr' ? x.cyr : x.lat);
  if (isWord(e)) {
    const right = label(e);
    let choices: string[] | null = null;
    if (p.mode === 'choice') {
      const others = [...new Set((pool as WordItem[]).filter((w) => w.key !== e.key).map(label))].filter((l) => l !== right);
      const picked: string[] = [];
      while (picked.length < 3 && others.length) picked.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
      choices = [right, ...picked].sort(() => Math.random() - 0.5);
    }
    return {
      key: e.key, kind: 'word', prompt: e.word, right, choices, choicesAreKana: false,
      check: (a) => (choices ? a === right : isWordCorrect(e, a)),
      reveal: `${right} · ${p.reading === 'cyr' ? e.lat : e.cyr}`, meaning: e.meaning, say: e.word, label: e.word,
    };
  }
  const items = pool as KanaItem[];
  if (p.drill === 'reverse' || p.drill === 'audio') {
    const src = p.drill === 'audio' ? items.filter((i) => !SAME_SOUND.has(i.kana)) : items;
    return {
      key: e.key, kind: p.drill === 'audio' ? 'audio' : 'reading', prompt: label(e), right: e.kana,
      choices: kanaChoicesFor(e, src, p.script), choicesAreKana: true, check: (a) => a === e.kana,
      reveal: `${e.kana} — ${e.cyr} · ${e.lat}`, say: e.kana, label: e.kana,
    };
  }
  const right = label(e);
  const choices = p.mode === 'choice' ? choicesFor(e, items, p.reading) : null;
  return {
    key: e.key, kind: 'kana', prompt: e.kana, right, choices, choicesAreKana: false,
    check: (a) => (choices ? a === right : isCorrect(e, a)),
    reveal: `${right} · ${p.reading === 'cyr' ? e.lat : e.cyr}`, say: e.kana, label: e.kana,
  };
}

function entriesFor(p: Prefs): Entry[] {
  if (p.drill === 'words') return wordItems(p.script, p.rows);
  const items = itemsFor(p.script, p.rows);
  return p.drill === 'audio' ? items.filter((i) => !SAME_SOUND.has(i.kana)) : items;
}

interface Answer {
  key: string;
  label: string;
  ok: boolean;
  ms: number;
}

export function Kana({ s, today }: { s: State; today: string }) {
  const w = ruleWeek(s, today);
  const [prefs, setPrefsRaw] = useState<Prefs>(() => loadPrefs(w));
  const setPrefs = (p: Partial<Prefs>) => {
    const n = { ...prefs, ...p };
    setPrefsRaw(n);
    savePrefs(n);
  };
  const [session, setSession] = useState<{ entries: Entry[] } | null>(null);
  const [result, setResult] = useState<Answer[] | null>(null);

  if (session) {
    return (
      <Session
        s={s}
        today={today}
        entries={session.entries}
        prefs={prefs}
        onDone={(a) => {
          setSession(null);
          setResult(a);
        }}
        onQuit={() => setSession(null)}
      />
    );
  }

  const start = (entries: Entry[]) => {
    setResult(null);
    setSession({ entries });
  };

  return (
    <div class="page">
      <Header title="Тренажёр каны" sub="Чем хуже знаешь знак, тем чаще он выпадает" />
      {result && (
        <Result
          answers={result}
          s={s}
          today={today}
          canMark={dailyBlocks(w).includes('kana')}
          onAgain={() => start(entriesFor(prefs))}
          onErrors={() => {
            const bad = new Set(result.filter((a) => !a.ok).map((a) => a.key));
            start(entriesFor(prefs).filter((e) => bad.has(e.key)));
          }}
        />
      )}
      <Setup prefs={prefs} setPrefs={setPrefs} s={s} onStart={() => start(entriesFor(prefs))} />
      <Table s={s} script={prefs.script} reading={prefs.reading} />
    </div>
  );
}

function Setup({ prefs, setPrefs, s, onStart }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; s: State; onStart: () => void }) {
  const [voiceName, setVoiceName] = useState<string | null | undefined>(undefined);
  const [check, setCheck] = useState<VoiceCheck | 'busy' | null>(null);
  useEffect(() => {
    if (prefs.drill === 'audio') findJapaneseVoice().then((v) => setVoiceName(v ? v.name : null));
  }, [prefs.drill]);
  const toggleRow = (id: string) =>
    setPrefs({ rows: prefs.rows.includes(id) ? prefs.rows.filter((r) => r !== id) : [...prefs.rows, id] });
  const groups: { g: 'basic' | 'dakuten' | 'yoon'; t: string }[] = [
    { g: 'basic', t: 'Основные' },
    { g: 'dakuten', t: 'С точками (゛゜)' },
    { g: 'yoon', t: 'Сочетания (ゃゅょ)' },
  ];
  const weak = itemsFor(prefs.script, ROWS.map((r) => r.id)).filter((i) => s.kana[i.key] && s.kana[i.key].box < MASTERED && s.kana[i.key].bad > 0);
  const count = entriesFor(prefs).length;
  const hasMode = prefs.drill === 'read' || prefs.drill === 'words';
  // голос не блокирует: на Android список голосов бывает пустым, хотя говорить браузер умеет
  const blocked = count === 0 || (prefs.drill === 'audio' && !speechSupported());
  const drill = DRILLS.find((d) => d.id === prefs.drill)!;
  return (
    <section class="card">
      <div class="seg">
        <button class={prefs.script === 'hira' ? 'on' : ''} onClick={() => setPrefs({ script: 'hira' })}>
          Хирагана
        </button>
        <button class={prefs.script === 'kata' ? 'on' : ''} onClick={() => setPrefs({ script: 'kata' })}>
          Катакана
        </button>
      </div>
      <div class="drills" role="radiogroup" aria-label="Режим">
        {DRILLS.map((d) => (
          <button role="radio" aria-checked={prefs.drill === d.id} class={`drill ${prefs.drill === d.id ? 'on' : ''}`} onClick={() => setPrefs({ drill: d.id })}>
            {d.title}
          </button>
        ))}
      </div>
      <p class="muted small-text">{drill.hint}{prefs.drill === 'words' && ' — из выбранных рядов.'}</p>
      {groups.map(({ g, t }) => (
        <div class="row-group">
          <div class="row-group-head">
            <span>{t}</span>
            <button
              class="linklike small-text"
              onClick={() => {
                const ids = ROWS.filter((r) => r.group === g).map((r) => r.id);
                const all = ids.every((i) => prefs.rows.includes(i));
                setPrefs({ rows: all ? prefs.rows.filter((r) => !ids.includes(r)) : [...new Set([...prefs.rows, ...ids])] });
              }}
            >
              {ROWS.filter((r) => r.group === g).every((r) => prefs.rows.includes(r.id)) ? 'снять все' : 'все'}
            </button>
          </div>
          <div class="chips">
            {ROWS.filter((r) => r.group === g).map((r) => (
              <button
                class={`chip ja ${prefs.rows.includes(r.id) ? 'on' : ''}`}
                aria-pressed={prefs.rows.includes(r.id)}
                onClick={() => toggleRow(r.id)}
              >
                {prefs.script === 'hira' ? r.title : toKata(r.title)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div class="settings-grid">
        {hasMode && (
          <label class="field">
            <span>Как отвечать</span>
            <select value={prefs.mode} onChange={(e) => setPrefs({ mode: (e.target as HTMLSelectElement).value as Prefs['mode'] })}>
              <option value="choice">Выбрать из 4</option>
              <option value="input">Набрать чтение</option>
            </select>
          </label>
        )}
        <label class="field">
          <span>Чтение</span>
          <select value={prefs.reading} onChange={(e) => setPrefs({ reading: (e.target as HTMLSelectElement).value as Reading })}>
            <option value="cyr">Кириллица</option>
            <option value="lat">Латиница</option>
          </select>
        </label>
        <label class="field">
          <span>Вопросов</span>
          <select value={prefs.length} onChange={(e) => setPrefs({ length: Number((e.target as HTMLSelectElement).value) })}>
            {[10, 20, 30, 50].map((n) => (
              <option value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      {hasMode && prefs.mode === 'input' && (
        <p class="muted small-text">
          Можно набирать и кириллицей (Поливанов), и латиницей (Хэпбёрн).{prefs.drill === 'words' && ' Долгие гласные можно писать как угодно: гакко:, гакко, gakkou.'}
        </p>
      )}
      {prefs.drill === 'audio' && (
        <div class="voice-box">
          <p class="small-text">
            {!speechSupported()
              ? 'Этот браузер не умеет синтез речи.'
              : voiceName
                ? <>Голос: <b>{voiceName}</b></>
                : voiceName === null
                  ? 'Японский голос в списке не найден — на Android так бывает, даже когда он есть. Проверь:'
                  : 'Ищу японский голос…'}
          </p>
          {speechSupported() && (
            <button
              class="btn small"
              disabled={check === 'busy'}
              onClick={async () => {
                setCheck('busy');
                setCheck(await checkVoice());
              }}
            >
              {check === 'busy' ? 'Проверяю…' : 'Проверить голос'}
            </button>
          )}
          {check && check !== 'busy' && (
            <div class={`banner ${check.ok ? 'good' : ''} voice-report`}>
              {check.lines.map((l) => (
                <p>{l}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <div class="row">
        <button class="btn primary" disabled={blocked} onClick={onStart}>
          Начать · {count} {prefs.drill === 'words' ? (count === 1 ? 'слово' : 'слов') : count === 1 ? 'знак' : 'знаков'}
        </button>
        {weak.length > 0 && (
          <button class="btn" onClick={() => setPrefs({ rows: [...new Set(weak.map((i) => i.row))] })}>
            Выбрать ряды с ошибками
          </button>
        )}
      </div>
      {prefs.rows.length === 0 && <p class="muted small-text">Выбери хотя бы один ряд.</p>}
      {prefs.drill === 'words' && count === 0 && prefs.rows.length > 0 && (
        <p class="muted small-text">Из этих рядов слов не набирается — добавь ещё ряды.</p>
      )}
    </section>
  );
}

function Session({
  s, today, entries, prefs, onDone, onQuit,
}: {
  s: State;
  today: string;
  entries: Entry[];
  prefs: Prefs;
  onDone: (a: Answer[]) => void;
  onQuit: () => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [entry, setEntry] = useState<Entry>(() => pickNext(entries, s.kana));
  const [feedback, setFeedback] = useState<{ ok: boolean; given: string } | null>(null);
  const [input, setInput] = useState('');
  const [voice, setVoice] = useState(false);
  const shownAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useMemo(() => makeQ(entry, entries, prefs), [entry]);
  const total = prefs.length;

  useEffect(() => {
    // голос пробуем всегда, когда браузер умеет синтез: найденный в списке — или просто по языку ja-JP
    findJapaneseVoice().then(() => setVoice(speechSupported()));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    if (q.kind === 'audio') findJapaneseVoice().then(() => speak(q.say!));
  }, [q]);

  const next = (all: Answer[]) => {
    setFeedback(null);
    if (all.length >= total) {
      finish(all);
      onDone(all);
      return;
    }
    // очищаем поле и засекаем время сразу при смене вопроса, а не в эффекте после отрисовки —
    // иначе быстро набранные первые буквы могли стереться
    setInput('');
    shownAt.current = performance.now();
    setEntry(pickNext(entries, { ...s.kana }, entry.key));
  };

  const finish = (all: Answer[]) => {
    // время в тренажёре — в минуты блока «Кана», если не идёт таймер этого блока (чтобы не считать дважды)
    const min = Math.round(all.reduce((a, b) => a + b.ms, 0) / 60000);
    if (min > 0 && timerBlock() !== 'kana') {
      update((st) => {
        const m = (st.minutes[deviceDayKey(today)] ??= {});
        m.kana = (m.kana ?? 0) + min;
      });
    }
  };

  const answer = (given: string) => {
    if (feedback) return;
    const ok = q.check(given);
    const ms = Math.min(performance.now() - shownAt.current, 20_000); // отвлёкся — не считаем как медленный ответ
    const all = [...answers, { key: q.key, label: q.label, ok, ms }];
    setAnswers(all);
    setFeedback({ ok, given });
    update((st) => {
      st.kana[q.key] = applyAnswer(st.kana[q.key], ok);
      const d = (st.kanaLog[deviceDayKey(today)] ??= { n: 0, ok: 0, ms: 0 });
      d.n++;
      if (ok) d.ok++;
      d.ms += Math.round(ms);
    });
    if (ok && q.kind === 'word' && voice) speak(q.say!);
    if (ok) setTimeout(() => next(all), q.kind === 'word' ? 900 : 350);
  };

  // клавиатура: обработчик один, а состояние берёт из ссылки — всегда свежее, без пересоздания на каждый кадр
  const live = useRef({ feedback, answers, q, voice, next, answer, onQuit });
  live.current = { feedback, answers, q, voice, next, answer, onQuit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const L = live.current;
      if (L.feedback && !L.feedback.ok && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        L.next(L.answers);
      } else if (!L.feedback && L.q.choices && /^[1-4]$/.test(e.key)) {
        L.answer(L.q.choices[Number(e.key) - 1]);
      } else if (e.key === '0' && L.q.say && L.voice) {
        speak(L.q.say);
      } else if (e.key === 'Escape') L.onQuit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="page kana-session">
      <div class="session-top">
        <button class="btn ghost small" onClick={onQuit}>
          ✕ Закончить
        </button>
        <span class="counter">
          {Math.min(answers.length + (feedback ? 0 : 1), total)}/{total}
        </span>
      </div>
      <div class="progress">
        <div style={{ width: `${(answers.length / total) * 100}%` }} />
      </div>
      <div class={`kana-big kind-${q.kind} ${feedback ? (feedback.ok ? 'ok' : 'bad') : ''}`} lang={q.kind === 'reading' ? 'ru' : 'ja'}>
        {q.kind === 'audio' ? (
          <button class="speak-btn" onClick={() => speak(q.say!)} aria-label="Произнести ещё раз">
            🔊
          </button>
        ) : (
          <span class={q.kind === 'reading' ? '' : 'ja'}>{q.prompt}</span>
        )}
      </div>
      <div class="kana-feedback" aria-live="polite">
        {feedback && !feedback.ok && (
          <>
            Правильно: <b class={q.kind === 'word' || q.kind === 'kana' ? '' : 'ja'}>{q.reveal}</b>
            {q.meaning && <> · {q.meaning}</>}
          </>
        )}
        {feedback?.ok && (
          <span class="saved">
            Верно{q.meaning && ` · ${q.meaning}`}
          </span>
        )}
      </div>
      {q.choices ? (
        <div class={`choices ${q.choicesAreKana ? 'kana-choices' : ''}`}>
          {q.choices.map((c, i) => (
            <button
              class={`choice ${q.choicesAreKana ? 'ja' : ''} ${feedback && c === q.right ? 'right' : ''} ${feedback && !feedback.ok && c === feedback.given ? 'wrong' : ''}`}
              lang={q.choicesAreKana ? 'ja' : undefined}
              onClick={() => answer(c)}
              disabled={!!feedback}
            >
              <span class="choice-n">{i + 1}</span>
              {c}
            </button>
          ))}
        </div>
      ) : (
        <form
          class="kana-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!feedback && input.trim()) answer(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder={prefs.reading === 'cyr' ? (q.kind === 'word' ? 'нэко' : 'си') : q.kind === 'word' ? 'neko' : 'shi'}
            aria-label="Чтение"
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setInput(v);
              // знак засчитываем сразу при совпадении; слово — по Enter (иначе «гакко» оборвётся до «гакко:»)
              if (q.kind === 'kana' && q.check(v)) answer(v);
            }}
          />
          <button class="btn" type="submit" disabled={!!feedback}>
            Ответить
          </button>
        </form>
      )}
      {feedback && !feedback.ok && (
        <button class="btn primary wide" onClick={() => next(answers)}>
          Дальше
        </button>
      )}
      <p class="muted small-text center">
        {q.choices ? 'Клавиши 1–4 — выбор, Enter — дальше' : 'Enter — ответить'}
        {q.say && voice ? ', 0 — произнести' : ''}, Esc — выход
      </p>
    </div>
  );
}

function Result({
  answers, s, today, canMark, onAgain, onErrors,
}: {
  answers: Answer[];
  s: State;
  today: string;
  canMark: boolean;
  onAgain: () => void;
  onErrors: () => void;
}) {
  if (answers.length === 0) return null;
  const ok = answers.filter((a) => a.ok).length;
  const avg = answers.reduce((a, b) => a + b.ms, 0) / answers.length / 1000;
  const errors = [...new Set(answers.filter((a) => !a.ok).map((a) => a.label))];
  const marked = !!s.days[today]?.done.kana;
  return (
    <section class="card current">
      <h2>Результат</h2>
      <div class="stats-row result-stats">
        <div>
          <b>{Math.round((ok / answers.length) * 100)}%</b>
          <span>
            верно ({ok}/{answers.length})
          </span>
        </div>
        <div>
          <b>{avg.toFixed(1)} с</b>
          <span>в среднем на ответ</span>
        </div>
      </div>
      {errors.length > 0 && (
        <p>
          Ошибки:{' '}
          <span class="ja" lang="ja">
            {errors.join('、')}
          </span>
        </p>
      )}
      <div class="row">
        <button class="btn primary" onClick={onAgain}>
          Ещё раз
        </button>
        {errors.length > 0 && (
          <button class="btn" onClick={onErrors}>
            Только ошибки
          </button>
        )}
        {canMark &&
          (marked ? (
            <span class="saved">Блок «Кана» на сегодня отмечен ✓</span>
          ) : (
            <button class="btn" onClick={() => update((st) => ((st.days[today] ??= { done: {} }).done.kana = true))}>
              Засчитать блок «Кана»
            </button>
          ))}
      </div>
    </section>
  );
}

function Table({ s, script, reading }: { s: State; script: Script; reading: Reading }) {
  const all = itemsFor(script, ROWS.map((r) => r.id));
  const mastered = all.filter((i) => (s.kana[i.key]?.box ?? 0) >= MASTERED).length;
  return (
    <section class="card">
      <div class="card-head">
        <h2>{script === 'hira' ? 'Хирагана' : 'Катакана'}: что уже знаю</h2>
        <span class="counter">
          {mastered}/{all.length}
        </span>
      </div>
      <div class="kana-table">
        {ROWS.map((r) => (
          <div class={`kana-row g-${r.group}`}>
            {itemsFor(script, [r.id]).map((i) => {
              const st = s.kana[i.key];
              const lvl = !st ? 'new' : st.box >= MASTERED ? 'known' : st.box >= 2 ? 'mid' : 'weak';
              return (
                <div class={`kana-cell lvl-${lvl}`} title={st ? `верно ${st.ok}, ошибок ${st.bad}` : 'ещё не встречался'}>
                  <span class="ja" lang="ja">
                    {i.kana}
                  </span>
                  <small>{reading === 'cyr' ? i.cyr : i.lat}</small>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div class="legend">
        <span>
          <i class="lg lvl-known" /> знаю
        </span>
        <span>
          <i class="lg lvl-mid" /> почти
        </span>
        <span>
          <i class="lg lvl-weak" /> путаю
        </span>
        <span>
          <i class="lg lvl-new" /> не было
        </span>
      </div>
    </section>
  );
}
