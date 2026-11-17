import { useEffect, useState } from 'preact/hooks';
import { update } from '../store.ts';
import { fmtDay, planWeekOf, type State } from '../logic.ts';
import { Header } from '../ui.tsx';

export function Diary({ s, today }: { s: State; today: string }) {
  const [editing, setEditing] = useState(today);
  const saved = s.diary[editing] ?? '';
  const [text, setText] = useState(saved);
  const [flash, setFlash] = useState(false);

  useEffect(() => setText(s.diary[editing] ?? ''), [editing]);

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
