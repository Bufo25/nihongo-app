import { useState } from 'preact/hooks';
import { update } from '../store.ts';
import { useDevice } from '../device.ts';
import { pullFromAnki } from '../anki.ts';
import { LESSONS_TOTAL, fmtDay, lastSolidLesson, latestWords, lessonsDone, lessonsOfWeek, ruleWeek, type State } from '../logic.ts';
import { Header, LessonChip, Progress as Bar } from '../ui.tsx';

export const WORD_GOAL = 800;

export function ProgressScreen({ s, today }: { s: State; today: string }) {
  const w = ruleWeek(s, today);
  const planned = lessonsOfWeek(w);
  const done = lessonsDone(s);
  const solid = lastSolidLesson(s);

  return (
    <div class="page">
      <Header title="Прогресс" sub="Уроки Minna no Nihongo I и слова в Anki" />

      <section class="card">
        <div class="card-head">
          <h2>Уроки Minna 1–{LESSONS_TOTAL}</h2>
          <span class="counter">
            {done}/{LESSONS_TOTAL}
          </span>
        </div>
        <Bar value={done} max={LESSONS_TOTAL} />
        <div class="lesson-grid">
          {Array.from({ length: LESSONS_TOTAL }, (_, i) => (
            <LessonChip s={s} n={i + 1} planned={planned.includes(i + 1)} />
          ))}
        </div>
        <p class="muted small-text">
          Нажатие: в процессе → пройден → сброс.
          {planned.length > 0 && ` По плану на этой неделе — уроки ${planned.join(' и ')} (обведены).`}
          {solid > 0 && ` Пройдено подряд: 1–${solid}.`}
        </p>
      </section>

      <Words s={s} today={today} />
    </div>
  );
}

export function WordsInput({ s, today, compact = false }: { s: State; today: string; compact?: boolean }) {
  const last = latestWords(s);
  const [v, setV] = useState(String(s.words[today] ?? last?.count ?? ''));
  const dev = useDevice();
  const [anki, setAnki] = useState<{ busy?: boolean; msg?: string; err?: boolean }>({});
  const n = Number(v);
  const valid = v.trim() !== '' && Number.isInteger(n) && n >= 0 && n < 100000;

  return (
    <div class={compact ? '' : 'words-input'}>
      <div class="row">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          class="num-input"
          value={v}
          aria-label="Сколько слов в Anki"
          onInput={(e) => setV((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && valid && update((st) => (st.words[today] = n))}
        />
        <button class="btn primary small" disabled={!valid || s.words[today] === n} onClick={() => update((st) => (st.words[today] = n))}>
          {s.words[today] !== undefined ? 'Обновить' : 'Записать'}
        </button>
        {dev.ankiEnabled && (
          <button
            class="btn small"
            disabled={anki.busy}
            onClick={async () => {
              setAnki({ busy: true });
              try {
                const c = await pullFromAnki();
                setV(String(c));
                setAnki({ msg: `Из Anki: ${c}` });
              } catch (e) {
                setAnki({ msg: e instanceof Error ? e.message : String(e), err: true });
              }
            }}
          >
            {anki.busy ? 'Спрашиваю Anki…' : 'Взять из Anki'}
          </button>
        )}
      </div>
      {anki.msg && <p class={`small-text ${anki.err ? 'error-text' : 'muted'}`}>{anki.msg}</p>}
      {!compact && (
        <p class="muted small-text">
          Где взять число: в Anki открой «Просмотр» и найди <code>deck:KaishiRu* -is:new</code> — количество показано в заголовке окна.
          {!dev.ankiEnabled && ' На ПК можно подтягивать автоматически через AnkiConnect — см. настройки.'}
        </p>
      )}
    </div>
  );
}

function Words({ s, today }: { s: State; today: string }) {
  const entries = Object.entries(s.words).sort(([a], [b]) => (a < b ? 1 : -1));
  const last = entries[0];
  const count = last?.[1] ?? 0;
  return (
    <section class="card">
      <div class="card-head">
        <h2>Слова в Anki</h2>
        <span class="counter">цель ~600–{WORD_GOAL}</span>
      </div>
      <div class="words-hero">
        <span class="num">{count}</span>
        <span class="muted">{last ? `на ${fmtDay(last[0])}` : 'ещё не записано'}</span>
      </div>
      <div class="milestones">
        <Bar value={Math.min(count, WORD_GOAL)} max={WORD_GOAL} />
        <div class="ms" style={{ left: '50%' }}>
          <span>400</span>
          <small>месяц 2</small>
        </div>
        <div class="ms" style={{ left: '75%' }}>
          <span>600</span>
          <small>месяц 3</small>
        </div>
      </div>
      <WordsInput s={s} today={today} />
      {entries.length > 0 && (
        <table class="norm words-history">
          <tbody>
            {entries.slice(0, 12).map(([k, n], i) => {
              const prev = entries[i + 1]?.[1];
              return (
                <tr>
                  <td>{fmtDay(k)}</td>
                  <td>{n}</td>
                  <td class="muted">{prev !== undefined && n !== prev ? `${n > prev ? '+' : ''}${n - prev}` : ''}</td>
                  <td>
                    <button
                      class="linklike small-text"
                      aria-label={`Удалить запись за ${fmtDay(k)}`}
                      onClick={() => update((st) => delete st.words[k])}
                    >
                      удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
