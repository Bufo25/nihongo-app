import { useEffect } from 'preact/hooks';
import { update } from '../store.ts';
import { canShrink, fmtRange, planWeekOf, weekRange, type State } from '../logic.ts';
import { BLOCKS, GOAL, MISSED_RULES, MONTHS, RULES, WEEKS } from '../plan.ts';
import { Check, Header } from '../ui.tsx';

export function PlanScreen({ s, today }: { s: State; today: string }) {
  const cur = planWeekOf(s, today);

  useEffect(() => {
    document.getElementById('current-week')?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div class="page">
      <Header title="План на 12 недель" sub={GOAL} />

      {MONTHS.map((m) => (
        <section class="month">
          <h2 class="month-title">
            <span class="month-n">Месяц {m.n}</span> {m.title}
          </h2>
          {WEEKS.slice((m.n - 1) * 4, m.n * 4).map((w) => {
            const r = weekRange(s, w.n);
            const isCur = w.n === cur;
            const past = cur > w.n;
            const extra = (s.weekLengths[w.n - 1] - 7) / 7;
            const doneTasks = w.tasks.filter((_, i) => s.tasks[`w${w.n}t${i}`]).length;
            return (
              <article class={`card week ${isCur ? 'current' : ''} ${past ? 'past' : ''}`} id={isCur ? 'current-week' : undefined}>
                <div class="week-top">
                  <div>
                    <div class="eyebrow">
                      Неделя {w.n}
                      {r && ` · ${fmtRange(r.start, r.end)}`}
                      {extra > 0 && ` · продлена +${extra * 7} дн.`}
                    </div>
                    <h3>{w.focus}</h3>
                  </div>
                  {isCur ? (
                    <span class="pill ok">сейчас</span>
                  ) : (
                    <span class="counter">
                      {doneTasks}/{w.tasks.length}
                    </span>
                  )}
                </div>
                <ul class="checklist compact">
                  {w.tasks.map((t, i) => {
                    const id = `w${w.n}t${i}`;
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
                {isCur && s.startDate && (
                  <div class="week-actions">
                    <button class="btn small" onClick={() => update((st) => (st.weekLengths[w.n - 1] += 7))}>
                      Продлить неделю на 7 дней
                    </button>
                    {canShrink(s, w.n, today) && (
                      <button class="btn ghost small" onClick={() => update((st) => (st.weekLengths[w.n - 1] -= 7))}>
                        Отменить продление
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <section class="card soft">
        <h3>Ежедневная норма</h3>
        <table class="norm">
          <tbody>
            {BLOCKS.map((b) => (
              <tr>
                <td>{b.title}</td>
                <td>{b.time}</td>
                <td class="muted">{b.whenText}</td>
              </tr>
            ))}
            <tr>
              <td>Разбор недели</td>
              <td>10 мин</td>
              <td class="muted">Раз в неделю, в выходной</td>
            </tr>
            <tr>
              <td>Аниме / Hololive</td>
              <td>сколько хочешь</td>
              <td class="muted">Награда после обязательной части</td>
            </tr>
          </tbody>
        </table>
        <p class="muted small-text">Минимум на «плохой день»: только повторения в Anki (5 минут).</p>
      </section>

      <section class="card soft">
        <h3>Правила</h3>
        <ul class="plain">
          {RULES.map((r) => (
            <li>{r}</li>
          ))}
        </ul>
        <h3>Если пропустил</h3>
        <ul class="plain">
          {MISSED_RULES.map((r) => (
            <li>
              <b>{r.when}:</b> {r.what}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
