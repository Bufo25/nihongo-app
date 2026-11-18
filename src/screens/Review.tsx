import { useState } from 'preact/hooks';
import { update } from '../store.ts';
import { activeBlocks, addDays, countInWeek, dayStatus, fmtRange, isWeekend, mondayOf, planWeekOf, ruleWeek, type Review, type State } from '../logic.ts';
import { Header } from '../ui.tsx';

const QUESTIONS: { k: 'good' | 'missed' | 'change'; q: string; ph: string }[] = [
  { k: 'good', q: 'Что получилось?', ph: 'Например: каждый день Anki, дошёл до урока 3' },
  { k: 'missed', q: 'Что пропустил и почему?', ph: 'Без оценок — просто причина' },
  { k: 'change', q: 'Что поменять на следующей неделе?', ph: 'Одно маленькое изменение' },
];

/** Новая неделя — новый черновик: форма пересоздаётся по ключу, без эффекта, который мог затереть набранное. */
export function ReviewScreen({ s, today }: { s: State; today: string }) {
  return <ReviewBody key={mondayOf(today)} s={s} today={today} />;
}

function ReviewBody({ s, today }: { s: State; today: string }) {
  const mon = mondayOf(today);
  const saved = s.reviews[mon];
  const [draft, setDraft] = useState({ good: saved?.good ?? '', missed: saved?.missed ?? '', change: saved?.change ?? '' });
  const [flash, setFlash] = useState(false);

  const dirty = QUESTIONS.some((q) => draft[q.k] !== (saved?.[q.k] ?? ''));
  const empty = QUESTIONS.every((q) => !draft[q.k].trim());

  const save = () => {
    update((st) => {
      st.reviews[mon] = { ...draft, savedAt: new Date().toISOString() };
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  };

  const history = Object.entries(s.reviews)
    .filter(([k]) => k !== mon)
    .sort(([a], [b]) => (a < b ? 1 : -1));

  return (
    <div class="page">
      <Header title="Разбор недели" sub={`${fmtRange(mon, addDays(mon, 6))} · неделя плана ${ruleWeek(s, today)}`} />

      {!isWeekend(today) && !saved && (
        <div class="banner">Разбор по плану — в выходной. Но если удобнее сейчас, можно и сейчас.</div>
      )}

      <WeekStats s={s} mon={mon} today={today} />

      <section class="card">
        {QUESTIONS.map((q) => (
          <label class="field">
            <span>{q.q}</span>
            <textarea
              rows={3}
              value={draft[q.k]}
              placeholder={q.ph}
              onInput={(e) => setDraft({ ...draft, [q.k]: (e.target as HTMLTextAreaElement).value })}
            />
          </label>
        ))}
        <div class="row">
          <button class="btn primary" onClick={save} disabled={!dirty || empty}>
            Сохранить
          </button>
          {flash && <span class="saved">Сохранено ✓</span>}
          {!flash && saved && !dirty && <span class="muted small-text">Сохранено</span>}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 class="section-title">Прошлые разборы</h2>
          {history.map(([k, r]) => (
            <PastReview k={k} r={r} s={s} />
          ))}
        </section>
      )}
    </div>
  );
}

function WeekStats({ s, mon, today }: { s: State; mon: string; today: string }) {
  let full = 0;
  let light = 0;
  let none = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(mon, i);
    if (k > today) break;
    const st = dayStatus(s, k);
    if (st === 'full') full++;
    else if (st === 'light') light++;
    else if (planWeekOf(s, k) > 0) none++;
  }
  const weekly = activeBlocks(ruleWeek(s, today)).filter((b) => b.freq === '3x');
  return (
    <section class="card soft stats-row">
      <div>
        <b>{full}</b>
        <span>полных дней</span>
      </div>
      <div>
        <b>{light}</b>
        <span>лёгких</span>
      </div>
      <div>
        <b>{none}</b>
        <span>пропусков</span>
      </div>
      {weekly.map((b) => (
        <div>
          <b>{countInWeek(s, b.id, mon)}/3</b>
          <span>{b.title.toLowerCase()}</span>
        </div>
      ))}
    </section>
  );
}

function PastReview({ k, r }: { k: string; r: Review; s: State }) {
  return (
    <details class="card past-review">
      <summary>
        <span>{fmtRange(k, addDays(k, 6))}</span>
        <span class="muted small-text">{r.change ? `→ ${r.change.slice(0, 50)}${r.change.length > 50 ? '…' : ''}` : ''}</span>
      </summary>
      {QUESTIONS.map((q) =>
        r[q.k] ? (
          <div class="qa">
            <div class="q">{q.q}</div>
            <div class="a">{r[q.k]}</div>
          </div>
        ) : null,
      )}
    </details>
  );
}
