import { update } from '../store.ts';
import { monthOfWeek, planWeekOf, type State } from '../logic.ts';
import { MONTHS } from '../plan.ts';
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
