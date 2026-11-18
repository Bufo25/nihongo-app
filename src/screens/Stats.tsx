import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { fmtDay, fmtRange, plural, type State } from '../logic.ts';
import {
  calendarWeeks, fmtHoursShort, fmtMinutes, heatmap, minutesByBlock, monthRows, planWeekRows, totals, type HeatDay,
} from '../stats.ts';
import { BLOCK_BY_ID, MONTHS, type BlockId } from '../plan.ts';
import { Header } from '../ui.tsx';

const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function Stats({ s, today }: { s: State; today: string }) {
  const t = totals(s, today);
  const weeks = calendarWeeks(s, today, 8);
  const planRows = planWeekRows(s, today);
  return (
    <div class="page">
      <Header title="Статистика" sub="Как идут занятия — по дням, неделям и месяцам плана" />

      <section class="kpis">
        <Tile label="Засчитано дней" value={String(t.counted)} sub={t.sinceStart ? `из ${t.sinceStart} с начала плана` : 'план ещё не начат'} />
        <Tile label="Полных дней" value={`${pct(t.full, t.counted)}%`} sub={`${t.full} ${plural(t.full, 'день', 'дня', 'дней')} со всей нормой`} />
        <Tile label="Время на японский" value={fmtHoursShort(t.minutes)} sub="по таймеру и тренажёру" />
        <Tile label="Тренажёр каны" value={t.kanaN ? `${pct(t.kanaOk, t.kanaN)}%` : '—'} sub={t.kanaN ? `верно из ${t.kanaN} ответов` : 'ещё не было занятий'} />
      </section>

      <Card title="Активность" sub="Последние 16 недель">
        <Heatmap cols={heatmap(s, today, 16)} />
      </Card>

      <Card title="Недели плана" sub="Засчитанные дни в каждой неделе">
        {planRows.length ? (
          <>
            <Columns
              max={7}
              ticks={[0, 7]}
              data={planRows.map((w) => ({
                label: String(w.n),
                total: w.full + w.light,
                capLabel: String(w.full + w.light),
                parts: [
                  { value: w.full, cls: 'seg-full' },
                  { value: w.light, cls: 'seg-light' },
                ],
                tip: [
                  `Неделя ${w.n} · ${fmtRange(w.start, w.end)}`,
                  `${w.full} полных, ${w.light} лёгких из ${w.days} ${plural(w.days, 'дня', 'дней', 'дней')}`,
                  `Учебник ${w.textbook}/3, шэдоуинг ${w.shadowing}/3`,
                ],
                current: w.current,
              }))}
            />
            <div class="legend">
              <span>
                <i class="lg seg-full" /> полный день
              </span>
              <span>
                <i class="lg seg-light" /> лёгкий день
              </span>
            </div>
            <TableToggle>
              <table class="norm data-table">
                <thead>
                  <tr>
                    <th>Неделя</th>
                    <th>Полных</th>
                    <th>Лёгких</th>
                    <th>Учебник</th>
                    <th>Шэдоуинг</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((w) => (
                    <tr>
                      <td>
                        {w.n} <span class="muted small-text">{fmtRange(w.start, w.end)}</span>
                      </td>
                      <td>{w.full}</td>
                      <td>{w.light}</td>
                      <td>{w.textbook}/3</td>
                      <td>{w.shadowing}/3</td>
                      <td>{w.minutes ? fmtHoursShort(w.minutes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableToggle>
          </>
        ) : (
          <Empty>Появится, когда начнётся план.</Empty>
        )}
      </Card>

      <Card title="Время по неделям" sub="Минуты за календарную неделю, последние 8">
        {weeks.some((w) => w.minutes) ? (
          <>
            <Columns
              max={Math.max(60, ...weeks.map((w) => w.minutes))}
              ticks={null}
              data={weeks.map((w, i) => ({
                label: fmtDay(w.mon).replace(/ .*/, '') + ' ' + MON_SHORT[Number(w.mon.slice(5, 7)) - 1],
                total: w.minutes,
                capLabel: w.minutes ? String(w.minutes) : '',
                parts: [{ value: w.minutes, cls: 'seg-full' }],
                tip: [
                  `Неделя с ${fmtDay(w.mon)}: ${fmtMinutes(w.minutes)}`,
                  ...Object.entries(w.byBlock).map(([b, m]) => `${BLOCK_BY_ID[b as BlockId].title}: ${m} мин`),
                ],
                current: i === weeks.length - 1,
              }))}
            />
            <h3 class="chart-sub">По блокам за всё время</h3>
            <RankedBars items={minutesByBlock(s, today).map((b) => ({ name: b.title, value: b.minutes, display: fmtHoursShort(b.minutes) }))} />
          </>
        ) : (
          <Empty>Появится, когда позанимаешься с таймером (кнопка ▶ рядом с блоком на «Сегодня») или в тренажёре каны.</Empty>
        )}
      </Card>

      <Card title="Тренажёр каны" sub="Доля верных ответов по неделям, последние 8">
        {weeks.some((w) => w.kanaN) ? (
          <>
            <Columns
              max={100}
              ticks={[0, 50, 100]}
              unit="%"
              data={weeks.map((w, i) => ({
                label: fmtDay(w.mon).replace(/ .*/, '') + ' ' + MON_SHORT[Number(w.mon.slice(5, 7)) - 1],
                total: w.kanaN ? pct(w.kanaOk, w.kanaN) : 0,
                capLabel: w.kanaN ? `${pct(w.kanaOk, w.kanaN)}%` : '',
                parts: [{ value: w.kanaN ? pct(w.kanaOk, w.kanaN) : 0, cls: 'seg-full' }],
                tip: w.kanaN
                  ? [`Неделя с ${fmtDay(w.mon)}`, `${pct(w.kanaOk, w.kanaN)}% верно (${w.kanaOk} из ${w.kanaN})`, `${(w.kanaMs / w.kanaN / 1000).toFixed(1)} с на ответ`]
                  : [`Неделя с ${fmtDay(w.mon)}: занятий не было`],
                current: i === weeks.length - 1,
              }))}
            />
            <TableToggle>
              <table class="norm data-table">
                <thead>
                  <tr>
                    <th>Неделя с</th>
                    <th>Ответов</th>
                    <th>Верно</th>
                    <th>Скорость</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks
                    .filter((w) => w.kanaN)
                    .map((w) => (
                      <tr>
                        <td>{fmtDay(w.mon)}</td>
                        <td>{w.kanaN}</td>
                        <td>{pct(w.kanaOk, w.kanaN)}%</td>
                        <td>{(w.kanaMs / w.kanaN / 1000).toFixed(1)} с</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableToggle>
          </>
        ) : (
          <Empty>Появится после первого занятия в тренажёре.</Empty>
        )}
      </Card>

      <Card title="По месяцам плана">
        {monthRows(s, today).length ? (
          <table class="norm data-table">
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Засчитано</th>
                <th>Полных</th>
                <th>Время</th>
                <th>Кана</th>
              </tr>
            </thead>
            <tbody>
              {monthRows(s, today).map((m) => (
                <tr>
                  <td>
                    {m.n} <span class="muted small-text">{MONTHS[m.n - 1].title}</span>
                  </td>
                  <td>
                    {m.counted}/{m.days}
                  </td>
                  <td>{pct(m.full, m.days)}%</td>
                  <td>{m.minutes ? fmtHoursShort(m.minutes) : '—'}</td>
                  <td>{m.kanaN ? `${pct(m.kanaOk, m.kanaN)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Появится, когда начнётся план.</Empty>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div class="kpi card">
      <div class="kpi-label">{label}</div>
      <div class="kpi-value">{value}</div>
      <div class="kpi-sub">{sub}</div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ComponentChildren }) {
  return (
    <section class="card chart-card">
      <h2>{title}</h2>
      {sub && <p class="muted small-text">{sub}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ComponentChildren }) {
  return <p class="muted small-text empty">{children}</p>;
}

function TableToggle({ children }: { children: ComponentChildren }) {
  return (
    <details class="table-toggle">
      <summary class="small-text">Таблица</summary>
      {children}
    </details>
  );
}

// ---------- подсказка при наведении ----------

interface Tip {
  lines: string[];
  x: number;
  y: number;
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (lines: string[]) => (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    const box = el.closest('.chart-wrap')!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ lines, x: r.left + r.width / 2 - box.left, y: r.top - box.top });
  };
  const hide = () => setTip(null);
  const view = tip && (
    <div class="tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }} role="tooltip">
      {tip.lines.map((l, i) => (i === 0 ? <b>{l}</b> : <div>{l}</div>))}
    </div>
  );
  return { show, hide, view };
}

// ---------- столбики ----------

interface Col {
  label: string;
  total: number;
  capLabel: string;
  parts: { value: number; cls: string }[];
  tip: string[];
  current?: boolean;
}

function Columns({ data, max, ticks, unit = '' }: { data: Col[]; max: number; ticks: number[] | null; unit?: string }) {
  const { show, hide, view } = useTip();
  const H = 140;
  return (
    <div class="chart-wrap">
      <div class="cols" style={{ height: `${H + 22}px` }}>
        {ticks && (
          <div class="ticks" aria-hidden="true">
            {ticks.map((t) => (
              <div class="tick" style={{ bottom: `${(t / max) * H + 22}px` }}>
                <span>
                  {t}
                  {unit}
                </span>
              </div>
            ))}
          </div>
        )}
        {data.map((c) => (
          <div
            class={`col ${c.current ? 'current' : ''}`}
            tabIndex={0}
            aria-label={c.tip.join('. ')}
            onPointerEnter={show(c.tip)}
            onPointerLeave={hide}
            onFocus={show(c.tip)}
            onBlur={hide}
          >
            <div class="col-plot" style={{ height: `${H}px` }}>
              <span class="cap" style={{ bottom: `${(c.total / max) * H + 4}px` }}>
                {c.capLabel}
              </span>
              <div class="stack">
                {[...c.parts].reverse().map((p) =>
                  p.value > 0 ? <div class={`seg ${p.cls}`} style={{ height: `${(p.value / max) * H}px` }} /> : null,
                )}
              </div>
            </div>
            <span class="col-label">{c.label}</span>
          </div>
        ))}
      </div>
      {view}
    </div>
  );
}

function RankedBars({ items }: { items: { name: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul class="ranked">
      {items.map((i) => (
        <li>
          <span class="ranked-name">{i.name}</span>
          <span class="ranked-track">
            <span class="ranked-bar" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span class="ranked-val">{i.display}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- карта активности ----------

const HEAT_TEXT: Record<HeatDay['mark'], string> = {
  full: 'вся обязательная часть',
  'light-ok': 'лёгкий день',
  'light-broke': 'лёгкий день (второй за неделю)',
  none: 'не отмечено',
  future: '',
  before: 'до начала плана',
};

function Heatmap({ cols }: { cols: HeatDay[][] }) {
  const { show, hide, view } = useTip();
  return (
    <div class="chart-wrap">
      <div class="heat">
        <div class="heat-wd" aria-hidden="true">
          {['пн', '', 'ср', '', 'пт', '', 'вс'].map((d) => (
            <span>{d}</span>
          ))}
        </div>
        <div class="heat-grid">
          <div class="heat-months" aria-hidden="true">
            {cols.map((c, i) => {
              const m = Number(c[0].key.slice(5, 7));
              const prev = i ? Number(cols[i - 1][0].key.slice(5, 7)) : -1;
              return <span>{m !== prev ? MON_SHORT[m - 1] : ''}</span>;
            })}
          </div>
          <div class="heat-cols">
            {cols.map((c) => (
              <div class="heat-col">
                {c.map((d) =>
                  d.mark === 'future' ? (
                    <span class="heat-cell future" />
                  ) : (
                    <span
                      class={`heat-cell h-${d.mark}`}
                      tabIndex={0}
                      aria-label={`${fmtDay(d.key, true)}: ${HEAT_TEXT[d.mark]}`}
                      onPointerEnter={show([fmtDay(d.key, true), HEAT_TEXT[d.mark]])}
                      onPointerLeave={hide}
                      onFocus={show([fmtDay(d.key, true), HEAT_TEXT[d.mark]])}
                      onBlur={hide}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div class="legend">
        <span>
          <i class="lg h-full" /> вся норма
        </span>
        <span>
          <i class="lg h-light-ok" /> лёгкий день
        </span>
        <span>
          <i class="lg h-none" /> не отмечено
        </span>
      </div>
      {view}
    </div>
  );
}
