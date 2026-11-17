import { useState } from 'preact/hooks';
import { addDays, computeStreak, dayKey, plural, type Mark, type State } from '../logic.ts';
import { Header, Icon } from '../ui.tsx';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MARK_TITLE: Record<Mark, string> = {
  full: 'Вся обязательная часть',
  'light-ok': 'Лёгкий день — засчитан',
  'light-broke': 'Второй лёгкий день за неделю — серия прервалась',
  none: 'Ничего не отмечено',
};

export function Streak({ s, today }: { s: State; today: string }) {
  const info = computeStreak(s, today);
  const t = new Date();
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });

  const first = new Date(ym.y, ym.m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const firstKey = dayKey(first);
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let i = 0; i < daysInMonth; i++) cells.push(addDays(firstKey, i));
  while (cells.length % 7) cells.push(null);

  const shift = (d: number) =>
    setYm(({ y, m }) => {
      const n = new Date(y, m + d, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });

  return (
    <div class="page">
      <Header title="Серия дней" />
      <section class="card streak-hero">
        <div class="big">
          <Icon name="fire" size={34} />
          <span class="num">{info.current}</span>
        </div>
        <div class="muted">{plural(info.current, 'день', 'дня', 'дней')} подряд</div>
        <div class="stats">
          <div>
            <b>{info.best}</b>
            <span>лучшая серия</span>
          </div>
          <div>
            <b>{info.total}</b>
            <span>всего засчитано</span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="cal-head">
          <button class="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
              <Icon name="chev" />
            </span>
          </button>
          <h2>
            {MONTHS[ym.m]} {ym.y}
          </h2>
          <button class="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц">
            <Icon name="chev" />
          </button>
        </div>
        <div class="cal">
          {WD.map((d) => (
            <div class="cal-wd">{d}</div>
          ))}
          {cells.map((k) => {
            if (!k) return <div class="cal-cell empty" />;
            const mark: Mark = info.marks[k] ?? 'none';
            const future = k > today;
            const cls = ['cal-cell', `m-${mark}`, future ? 'future' : '', k === today ? 'today' : '', k === s.startDate ? 'start' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <div class={cls} title={future ? '' : MARK_TITLE[mark]}>
                <span class="d">{Number(k.slice(8))}</span>
                {(mark === 'full' || mark === 'light-ok') && <span class="x">✕</span>}
                {mark === 'light-broke' && <span class="x">·</span>}
              </div>
            );
          })}
        </div>
        <div class="legend">
          <span>
            <i class="lg full">✕</i> всё сделано
          </span>
          <span>
            <i class="lg light">✕</i> лёгкий день
          </span>
          <span>
            <i class="lg start" /> старт плана
          </span>
        </div>
      </section>

      <section class="card soft">
        <h3>Как считается серия</h3>
        <ul class="plain">
          <li>✕ — сделана вся обязательная часть дня.</li>
          <li>
            Лёгкий день — кнопка «плохой день» или сделано не всё. <b>Один лёгкий день в неделю</b> (пн–вс) засчитывается
            и серию не рвёт.
          </li>
          <li>Пустой день или второй лёгкий день за неделю обнуляют серию.</li>
          <li>Сегодняшний день не рвёт серию, пока он не закончился.</li>
        </ul>
      </section>
    </div>
  );
}
