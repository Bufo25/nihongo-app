import { update } from '../store.ts';
import { lessonsDone, latestWords, monthOfWeek, planWeekOf, type State } from '../logic.ts';
import { MONTHS } from '../plan.ts';
import { MASTERED, allItems } from '../kana.ts';
import { Check, Header, Progress } from '../ui.tsx';

export function Checkpoints({ s, today }: { s: State; today: string }) {
  const curMonth = monthOfWeek(Math.min(Math.max(planWeekOf(s, today), 1), 12));
  return (
    <div class="page">
      <Header title="Чекпоинты" sub="Отмечай, когда действительно получается" />
      {MONTHS.map((m) => {
        const ids = m.checkpoints.map((_, i) => `m${m.n}c${i}`);
        const done = ids.filter((id) => s.checkpoints[id]).length;
        return (
          <section class={`card ${m.n === curMonth ? 'current' : ''}`}>
            <div class="card-head">
              <h2>
                Месяц {m.n}: {m.title}
              </h2>
              <span class="counter">
                {done}/{ids.length}
              </span>
            </div>
            <Progress value={done} max={ids.length} />
            <ul class="checklist">
              {m.checkpoints.map((c, i) => {
                const id = ids[i];
                return (
                  <li>
                    <Check
                      checked={!!s.checkpoints[id]}
                      onChange={() => update((st) => (st.checkpoints[id] ? delete st.checkpoints[id] : (st.checkpoints[id] = true)))}
                    >
                      {c}
                    </Check>
                    {hint(s, id) && <span class="pill">{hint(s, id)}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Подсказка из данных приложения рядом с чекпоинтом. Отмечаешь всё равно сам. */
function hint(s: State, id: string): string | null {
  const done = lessonsDone(s);
  const words = latestWords(s)?.count;
  switch (id) {
    case 'm2c0':
      return `уроков пройдено: ${done}/8`;
    case 'm3c0':
      return `уроков пройдено: ${done}/14`;
    case 'm2c1':
      return words !== undefined ? `сейчас ${words}` : null;
    case 'm1c0': {
      return kanaHint(s, 'hira');
    }
    case 'm1c1':
      return kanaHint(s, 'kata');
    default:
      return null;
  }
}

function kanaHint(s: State, script: 'hira' | 'kata'): string | null {
  const items = allItems(script).slice(0, 46);
  const known = items.filter((i) => (s.kana[i.key]?.box ?? 0) >= MASTERED).length;
  return known > 0 ? `в тренажёре: ${known}/46` : null;
}
