import { useState } from 'preact/hooks';
import { update } from '../store.ts';
import { fmtDay, lessonsOfWeek, planWeekOf, ruleWeek, type State } from '../logic.ts';
import { diaryPromptsUpTo } from '../plan.ts';
import { Header } from '../ui.tsx';

export function Diary({ s, today }: { s: State; today: string }) {
  const [editing, setEditingRaw] = useState(today);
  const saved = s.diary[editing] ?? '';
  const [text, setText] = useState(saved);
  // текст подгружаем в момент выбора другого дня — не эффектом после отрисовки,
  // иначе он мог затереть то, что уже начали печатать
  const setEditing = (k: string) => {
    setEditingRaw(k);
    setText(s.diary[k] ?? '');
  };
  const [flash, setFlash] = useState(false);


  const save = () => {
    const t = text.trim();
    update((st) => {
      if (t) st.diary[editing] = t;
      else delete st.diary[editing];
      // запись в дневник отмечает блок «Дневник» за этот день
      if (t) (st.days[editing] ??= { done: {} }).done.diary = true;
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
    if (editing !== today) setEditing(today);
  };

  const entries = Object.entries(s.diary).sort(([a], [b]) => (a < b ? 1 : -1));
  const early = planWeekOf(s, today) < 9;

  return (
    <div class="page">
      <Header title="Дневник" sub="1–2 предложения на японском в день" />

      {early && (
        <div class="banner">
          По плану дневник начинается с месяца 3 (неделя 9). Писать раньше тоже можно — в чек-лист он попадёт с недели 9.
        </div>
      )}

      <Prompt s={s} today={today} onUse={(t) => setText(text ? `${text}\n${t}` : t)} />

      <section class="card">
        <label class="field">
          <span>{editing === today ? `Сегодня, ${fmtDay(today)}` : `Правка: ${fmtDay(editing, true)}`}</span>
          <textarea
            lang="ja"
            class="ja"
            rows={3}
            value={text}
            placeholder="きょうは にほんごを べんきょうしました。"
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
        </label>
        <div class="row">
          <button class="btn primary" onClick={save} disabled={text.trim() === saved}>
            Сохранить
          </button>
          {editing !== today && (
            <button class="btn ghost" onClick={() => setEditing(today)}>
              Отмена
            </button>
          )}
          {flash && <span class="saved">Сохранено ✓</span>}
        </div>
      </section>

      <h2 class="section-title">
        История <span class="muted">· {entries.length}</span>
      </h2>
      {entries.length === 0 && <p class="muted">Пока пусто. Первая запись — самая важная.</p>}
      <ul class="diary-list">
        {entries.map(([k, t]) => (
          <li class="card">
            <div class="diary-meta">
              <span class="muted small-text">{fmtDay(k, true)}</span>
              <button class="linklike small-text" onClick={() => setEditing(k)}>
                изменить
              </button>
            </div>
            <p lang="ja" class="ja">
              {t}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Номер урока для подсказок: самый дальний пройденный или «в процессе», иначе по плану недели. */
function currentLesson(s: State, today: string): number {
  const marked = Object.keys(s.lessons).map(Number);
  const byPlan = Math.max(0, ...lessonsOfWeek(ruleWeek(s, today)));
  return Math.max(0, byPlan, ...marked);
}

function Prompt({ s, today, onUse }: { s: State; today: string; onUse: (t: string) => void }) {
  const lesson = currentLesson(s, today);
  const prompts = diaryPromptsUpTo(lesson);
  // свежие уроки — в начале, чтобы чаще тренировать новое
  const ordered = [...prompts].reverse();
  const [i, setI] = useState(() => Number(today.slice(8)) % Math.min(ordered.length, 3));
  const p = ordered[i % ordered.length];
  return (
    <section class="card soft prompt-card">
      <div class="card-head">
        <span class="eyebrow">{p.lesson ? `Подсказка · урок ${p.lesson}` : 'Подсказка'}</span>
        <button class="linklike small-text" onClick={() => setI(i + 1)}>
          другая
        </button>
      </div>
      <p class="prompt-topic">{p.topic}</p>
      <p class="small-text">
        <span class="muted">Конструкция: </span>
        <span lang="ja" class="ja">
          {p.pattern}
        </span>
      </p>
      <p class="prompt-example ja" lang="ja">
        {p.example}
      </p>
      <button class="linklike small-text" onClick={() => onUse(p.example)}>
        вставить образец и переделать под себя
      </button>
    </section>
  );
}
