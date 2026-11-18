import { useState } from 'preact/hooks';
import { update } from '../store.ts';
import {
  activeBlocks, addDays, diffDays, computeStreak, countInWeek, dayStatus, fmtDay, gapBeforeToday, isWeekend, mondayOf,
  monthOfWeek, planWeekOf, plural, weekRange, lessonsOfWeek, lastSolidLesson, latestWords, type State,
} from '../logic.ts';
import { WordsInput } from './Progress.tsx';
import { SyncNotice } from './SyncNotice.tsx';
import { TimerStart } from './TimerBar.tsx';
import { MISSED_RULES, WEEKS, badDayText, blockHint, weekResources, type BlockId } from '../plan.ts';
import { Check, Header, Icon, LessonChip } from '../ui.tsx';

interface P {
  s: State;
  today: string;
}

export function Today({ s, today }: P) {
  if (!s.startDate) return <Onboarding today={today} />;

  const pw = planWeekOf(s, today);
  const w = Math.min(Math.max(pw, 1), 12);
  const week = WEEKS[w - 1];
  const rec = s.days[today] ?? { done: {} };
  const blocks = activeBlocks(w);
  const daily = blocks.filter((b) => b.freq === 'daily');
  const weekly = blocks.filter((b) => b.freq === '3x');
  const status = dayStatus(s, today);
  const streak = computeStreak(s, today);
  const gap = gapBeforeToday(s, today);
  const range = weekRange(s, w)!;
  const doneDaily = daily.filter((b) => rec.done[b.id]).length;

  const toggle = (id: BlockId) =>
    update((st) => {
      const d = (st.days[today] ??= { done: {} });
      if (d.done[id]) delete d.done[id];
      else d.done[id] = true;
    });

  const toggleBad = () =>
    update((st) => {
      const d = (st.days[today] ??= { done: {} });
      if (d.bad) delete d.bad;
      else d.bad = true;
    });

  let missed: { when: string; what: string } | null = null;
  if (gap !== null && gap >= 1 && !rec.bad && Object.keys(rec.done).length === 0) {
    missed = gap <= 4 ? MISSED_RULES[0] : gap <= 7 ? MISSED_RULES[1] : MISSED_RULES[2];
  }

  return (
    <div class="page">
      <Header title="Сегодня" sub={fmtDay(today, true)}>
        <a class="streak-chip" href="#/streak" title="Серия дней">
          <Icon name="fire" size={18} />
          {streak.current}
        </a>
      </Header>

      {pw === 0 && (
        <div class="banner">План начнётся {fmtDay(s.startDate)}. Можно уже отмечать — это разминка.</div>
      )}
      {pw === 13 && (
        <div class="banner good">
          12 недель позади. Продолжай ежедневную норму и смотри, что из чекпоинтов осталось.
        </div>
      )}

      <section class="card week-card">
        <div class="eyebrow">
          Неделя {w} из 12 · месяц {monthOfWeek(w)} · {fmtDay(range.start)} – {fmtDay(range.end)}
        </div>
        <h2>{week.focus}</h2>
        <ul class="tasks-inline">
          {week.tasks.map((t, i) => {
            const id = `w${w}t${i}`;
            return (
              <li>
                <Check
                  checked={!!s.tasks[id]}
                  onChange={() => update((st) => (st.tasks[id] ? delete st.tasks[id] : (st.tasks[id] = true)))}
                >
                  {t}
                </Check>
              </li>
            );
          })}
        </ul>
        {weekResources(w).length > 0 && (
          <div class="week-links">
            {weekResources(w).map((r) => (
              <a class="res-chip" href={r.url} target="_blank" rel="noopener noreferrer" title={r.note}>
                {r.name}
                <Icon name="ext" size={14} />
              </a>
            ))}
          </div>
        )}
        {lessonsOfWeek(w).length > 0 && (
          <div class="week-lessons">
            <span class="small-text muted">Уроки Minna:</span>
            {lessonsOfWeek(w).map((n) => (
              <LessonChip s={s} n={n} />
            ))}
            <a class="small-text" href="#/progress">
              все уроки →
            </a>
          </div>
        )}
      </section>

      <SyncNotice />

      {missed && (
        <div class="banner">
          <strong>
            Перерыв {gap} {plural(gap!, 'день', 'дня', 'дней')}.
          </strong>{' '}
          {missed.what}
          {missed === MISSED_RULES[2] && w >= 5 && (
            <> {lastSolidLesson(s) > 0 ? `Пройдено подряд: уроки 1–${lastSolidLesson(s)} — начни с урока ${lastSolidLesson(s)}.` : 'Начни с урока 1.'}</>
          )}
        </div>
      )}

      <section class="card">
        <div class="card-head">
          <h2>Обязательное</h2>
          <span class="counter">
            {doneDaily}/{daily.length}
          </span>
        </div>
        <ul class="checklist">
          {daily.map((b) => (
            <li>
              <Check checked={!!rec.done[b.id]} onChange={() => toggle(b.id)} meta={`${b.time} · ${blockHint(b.id, w)}`}>
                {b.title}
              </Check>
              {!rec.done[b.id] && b.id !== 'diary' && <TimerStart block={b.id} />}
              {b.id === 'diary' && (
                <a class="side-link" href="#/diary">
                  написать →
                </a>
              )}
              {b.id === 'kana' && (
                <a class="side-link" href="#/kana">
                  тренажёр →
                </a>
              )}
            </li>
          ))}
        </ul>

        {status === 'full' ? (
          <div class="reward">
            Обязательная часть сделана. Теперь аниме или Hololive — заслуженно 🎉
          </div>
        ) : rec.bad ? (
          <div class="bad-day on">
            <div>
              <strong>Плохой день засчитан.</strong> {badDayText(w)} — и отдыхай.
            </div>
            <button class="btn ghost small" onClick={toggleBad}>
              Отменить
            </button>
          </div>
        ) : (
          <div class="bad-day">
            <div>
              <strong>Нет сил?</strong> {badDayText(w)}. День засчитается.
            </div>
            <button class="btn small" onClick={toggleBad}>
              Плохой день
            </button>
          </div>
        )}
      </section>

      {weekly.length > 0 && (
        <section class="card">
          <div class="card-head">
            <h2>3 раза в неделю</h2>
          </div>
          <ul class="checklist">
            {weekly.map((b) => {
              const n = countInWeek(s, b.id, today);
              return (
                <li>
                  <Check
                    checked={!!rec.done[b.id]}
                    onChange={() => toggle(b.id)}
                    meta={`${b.time} · ${blockHint(b.id, w)}`}
                  >
                    {b.title}
                    <span class={`pill ${n >= 3 ? 'ok' : ''}`}>{n >= 3 ? 'норма недели ✓' : `${n}/3 за неделю`}</span>
                  </Check>
                  {!rec.done[b.id] && <TimerStart block={b.id} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {w >= 2 && wordsDue(s, today) && (
        <section class="card">
          <div class="card-head">
            <h2>Сколько слов в Anki?</h2>
            <a class="small-text" href="#/progress">
              прогресс →
            </a>
          </div>
          <p class="muted small-text">
            Раз в неделю — чтобы видеть путь к ~400 словам к месяцу 2 и 600–800 к концу плана.
            {latestWords(s) && ` В прошлый раз: ${latestWords(s)!.count}.`}
          </p>
          <WordsInput s={s} today={today} compact />
        </section>
      )}

      {isWeekend(today) && (
        <a class="card link-card" href="#/review">
          <div>
            <h2>Разбор недели</h2>
            <p class="muted">
              {s.reviews[mondayOf(today)] ? 'Сохранён ✓ — можно дополнить' : 'Выходной — 10 минут на три вопроса'}
            </p>
          </div>
          <Icon name="chev" />
        </a>
      )}

      <ExtendHint s={s} w={w} today={today} />
    </div>
  );
}

function ExtendHint({ s, w, today }: { s: State; w: number; today: string }) {
  const r = weekRange(s, w);
  if (!r || w > 12) return null;
  const left = diffDays(today, r.end);
  if (left > 2) return null;
  return (
    <p class="muted center small-text">
      Неделя заканчивается {left <= 0 ? 'сегодня' : fmtDay(r.end)}. Не успеваешь —{' '}
      <button class="linklike" onClick={() => update((st) => (st.weekLengths[w - 1] += 7))}>
        продли её на 7 дней
      </button>
      . Отставать нормально.
    </p>
  );
}

function Onboarding({ today }: { today: string }) {
  const [mode, setMode] = useState<'new' | 'already'>('new');
  const [date, setDate] = useState(today);
  const [week, setWeek] = useState(2);

  const start = () =>
    update((st) => {
      st.startDate = mode === 'new' ? date : addDays(today, -(week - 1) * 7);
    });

  return (
    <div class="page">
      <Header title="Японский с нуля" sub="3 месяца: кана, ~700 слов, Minna 1–14, простые видео с субтитрами" />
      <section class="card">
        <h2>С чего начнём?</h2>
        <div class="seg">
          <button class={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>
            Начинаю план
          </button>
          <button class={mode === 'already' ? 'on' : ''} onClick={() => setMode('already')}>
            Уже занимаюсь
          </button>
        </div>
        {mode === 'new' ? (
          <label class="field">
            <span>Первый день недели 1</span>
            <input type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value || today)} />
          </label>
        ) : (
          <label class="field">
            <span>Сейчас у меня неделя</span>
            <select value={week} onChange={(e) => setWeek(Number((e.target as HTMLSelectElement).value))}>
              {WEEKS.map((wk) => (
                <option value={wk.n}>
                  {wk.n} — {wk.focus}
                </option>
              ))}
            </select>
          </label>
        )}
        <button class="btn primary wide" onClick={start}>
          Поехали
        </button>
        <p class="muted small-text">Дату старта можно поменять в настройках. Данные хранятся только на этом устройстве.</p>
      </section>
    </div>
  );
}

/** Пора записать число слов: записей нет или последней больше 6 дней. Сегодняшняя запись — карточка остаётся до конца дня. */
function wordsDue(s: State, today: string): boolean {
  if (s.words[today] !== undefined) return true;
  const last = latestWords(s);
  return !last || diffDays(last.date, today) > 6;
}
