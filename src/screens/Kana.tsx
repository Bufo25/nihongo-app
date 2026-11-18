import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { update } from '../store.ts';
import { dailyBlocks, ruleWeek, type State } from '../logic.ts';
import {
  MASTERED, ROWS, applyAnswer, choicesFor, isCorrect, itemsFor, pickNext, toKata,
  type KanaItem, type Reading, type Script,
} from '../kana.ts';
import { Header } from '../ui.tsx';

interface Prefs {
  script: Script;
  rows: string[];
  mode: 'choice' | 'input';
  reading: Reading;
  length: number;
}

const PREFS_KEY = 'nihongo-kana-prefs';

function loadPrefs(week: number): Prefs {
  const d: Prefs = { script: week === 3 ? 'kata' : 'hira', rows: ['a', 'ka', 'sa'], mode: 'choice', reading: 'cyr', length: 20 };
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

interface Answer {
  item: KanaItem;
  ok: boolean;
  ms: number;
  given: string;
}

export function Kana({ s, today }: { s: State; today: string }) {
  const w = ruleWeek(s, today);
  const [prefs, setPrefsRaw] = useState<Prefs>(() => loadPrefs(w));
  const setPrefs = (p: Partial<Prefs>) => {
    const n = { ...prefs, ...p };
    setPrefsRaw(n);
    savePrefs(n);
  };
  const [session, setSession] = useState<{ items: KanaItem[] } | null>(null);
  const [result, setResult] = useState<Answer[] | null>(null);

  if (session) {
    return (
      <Session
        s={s}
        items={session.items}
        prefs={prefs}
        onDone={(a) => {
          setSession(null);
          setResult(a);
        }}
        onQuit={() => setSession(null)}
      />
    );
  }

  const start = (items: KanaItem[]) => {
    setResult(null);
    setSession({ items });
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
          onAgain={() => start(itemsFor(prefs.script, prefs.rows))}
          onErrors={() => {
            const bad = [...new Map(result.filter((a) => !a.ok).map((a) => [a.item.key, a.item])).values()];
            start(bad);
          }}
        />
      )}
      <Setup prefs={prefs} setPrefs={setPrefs} s={s} onStart={() => start(itemsFor(prefs.script, prefs.rows))} />
      <Table s={s} script={prefs.script} reading={prefs.reading} />
    </div>
  );
}

function Setup({ prefs, setPrefs, s, onStart }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; s: State; onStart: () => void }) {
  const toggleRow = (id: string) =>
    setPrefs({ rows: prefs.rows.includes(id) ? prefs.rows.filter((r) => r !== id) : [...prefs.rows, id] });
  const groups: { g: 'basic' | 'dakuten' | 'yoon'; t: string }[] = [
    { g: 'basic', t: 'Основные' },
    { g: 'dakuten', t: 'С точками (゛゜)' },
    { g: 'yoon', t: 'Сочетания (ゃゅょ)' },
  ];
  const weak = itemsFor(prefs.script, ROWS.map((r) => r.id)).filter((i) => s.kana[i.key] && s.kana[i.key].box < MASTERED && s.kana[i.key].bad > 0);
  const count = itemsFor(prefs.script, prefs.rows).length;
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
        <label class="field">
          <span>Как отвечать</span>
          <select value={prefs.mode} onChange={(e) => setPrefs({ mode: (e.target as HTMLSelectElement).value as Prefs['mode'] })}>
            <option value="choice">Выбрать из 4</option>
            <option value="input">Набрать чтение</option>
          </select>
        </label>
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
      {prefs.mode === 'input' && (
        <p class="muted small-text">Можно набирать и кириллицей (Поливанов), и латиницей (Хэпбёрн) — засчитается любой вариант.</p>
      )}
      <div class="row">
        <button class="btn primary" disabled={count === 0} onClick={onStart}>
          Начать · {count} {count === 1 ? 'знак' : 'знаков'}
        </button>
        {weak.length > 0 && (
          <button class="btn" onClick={() => setPrefs({ rows: [...new Set(weak.map((i) => i.row))] })}>
            Выбрать ряды с ошибками
          </button>
        )}
      </div>
      {prefs.rows.length === 0 && <p class="muted small-text">Выбери хотя бы один ряд.</p>}
    </section>
  );
}

function Session({
  s, items, prefs, onDone, onQuit,
}: {
  s: State;
  items: KanaItem[];
  prefs: Prefs;
  onDone: (a: Answer[]) => void;
  onQuit: () => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [item, setItem] = useState<KanaItem>(() => pickNext(items, s.kana));
  const [feedback, setFeedback] = useState<{ ok: boolean; given: string } | null>(null);
  const [input, setInput] = useState('');
  const shownAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const choices = useMemo(() => choicesFor(item, items, prefs.reading), [item]);
  const right = prefs.reading === 'cyr' ? item.cyr : item.lat;
  const total = prefs.length;

  useEffect(() => {
    shownAt.current = performance.now();
    setInput('');
    inputRef.current?.focus();
  }, [item]);

  const next = (all: Answer[]) => {
    setFeedback(null);
    if (all.length >= total) onDone(all);
    else setItem(pickNext(items, { ...s.kana }, item.key));
  };

  const answer = (given: string, ok: boolean) => {
    if (feedback) return;
    const a: Answer = { item, ok, given, ms: performance.now() - shownAt.current };
    const all = [...answers, a];
    setAnswers(all);
    setFeedback({ ok, given });
    update((st) => (st.kana[item.key] = applyAnswer(st.kana[item.key], ok)));
    if (ok) setTimeout(() => next(all), 350);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (feedback && !feedback.ok && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next(answers);
      } else if (!feedback && prefs.mode === 'choice' && /^[1-4]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        answer(c, c === right);
      } else if (e.key === 'Escape') onQuit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
      <div class={`kana-big ja ${feedback ? (feedback.ok ? 'ok' : 'bad') : ''}`} lang="ja">
        {item.kana}
      </div>
      <div class="kana-feedback" aria-live="polite">
        {feedback && !feedback.ok && (
          <>
            Правильно: <b>{right}</b>
            {prefs.reading === 'cyr' ? ` · ${item.lat}` : ` · ${item.cyr}`}
          </>
        )}
        {feedback?.ok && <span class="saved">Верно</span>}
      </div>
      {prefs.mode === 'choice' ? (
        <div class="choices">
          {choices.map((c, i) => (
            <button
              class={`choice ${feedback && c === right ? 'right' : ''} ${feedback && !feedback.ok && c === feedback.given ? 'wrong' : ''}`}
              onClick={() => answer(c, c === right)}
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
            if (!feedback && input.trim()) answer(input, isCorrect(item, input));
          }}
        >
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder={prefs.reading === 'cyr' ? 'си' : 'shi'}
            aria-label="Чтение"
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setInput(v);
              if (isCorrect(item, v)) answer(v, true);
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
        {prefs.mode === 'choice' ? 'Клавиши 1–4 — выбор, Enter — дальше, Esc — выход' : 'Enter — ответить, Esc — выход'}
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
  const errors = [...new Map(answers.filter((a) => !a.ok).map((a) => [a.item.key, a.item])).values()];
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
          <span>в среднем на знак</span>
        </div>
      </div>
      {errors.length > 0 && (
        <p>
          Ошибки:{' '}
          <span class="ja" lang="ja">
            {errors.map((e) => e.kana).join(' ')}
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
