import { update } from './store.ts';
import type { State } from './logic.ts';
import type { ComponentChildren } from 'preact';

export type IconName = 'today' | 'fire' | 'map' | 'flag' | 'chat' | 'pen' | 'link' | 'gear' | 'more' | 'check' | 'chev' | 'ext' | 'chart' | 'kana' | 'cloud' | 'stats';

const PATHS: Record<Exclude<IconName, 'kana'>, string> = {
  today: 'M4 6h16M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6M4 6V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1M8 2v4M16 2v4M8.5 14l2.5 2.5 4.5-5',
  fire: 'M12 21c4 0 7-2.7 7-6.8 0-3.6-2.4-6-4.3-8.2-.4 2-1.4 3.3-2.7 3.9C12.6 6.6 10.8 4.2 9 3c.3 3-1.6 5-3 7-1 1.4-1 2.6-1 4.2C5 18.3 8 21 12 21z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  chat: 'M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5',
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2L14.7 21h-4l-.3-2a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.4 10.3l2-3.4 1.9.7a7 7 0 0 1 2.1-1.2l.3-2h4l.3 2a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  stats: 'M3 12h4l3-8 4 16 3-8h4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chev: 'M9 6l6 6-6 6',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name === 'kana')
    return (
      <svg class="icon icon-kana" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <text x="12" y="18.5" text-anchor="middle" font-size="19" font-weight="600" fill="currentColor" font-family="'Yu Gothic UI','Hiragino Sans','Noto Sans JP',sans-serif">
          あ
        </text>
      </svg>
    );
  return (
    <svg
      class={`icon icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={name === 'more' ? 3 : 1.8}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Header({ title, sub, children }: { title: string; sub?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p class="sub">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

export function Check({
  checked,
  onChange,
  children,
  meta,
}: {
  checked: boolean;
  onChange: () => void;
  children: ComponentChildren;
  meta?: ComponentChildren;
}) {
  return (
    <label class={`check ${checked ? 'is-done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span class="box">
        <Icon name="check" size={16} />
      </span>
      <span class="check-body">
        <span class="check-title">{children}</span>
        {meta && <span class="check-meta">{meta}</span>}
      </span>
    </label>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div class="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

const LESSON_TITLE = ['не начат', 'в процессе', 'пройден'];

/** Урок Minna: нажатие переключает «не начат → в процессе → пройден». */
export function LessonChip({ s, n, planned = false }: { s: State; n: number; planned?: boolean }) {
  const st = s.lessons[String(n)] ?? 0;
  return (
    <button
      class={`lesson st-${st} ${planned ? 'planned' : ''}`}
      title={`Урок ${n}: ${LESSON_TITLE[st]}`}
      aria-label={`Урок ${n}: ${LESSON_TITLE[st]}`}
      onClick={() =>
        update((x) => {
          const next = ((st + 1) % 3) as 0 | 1 | 2;
          if (next === 0) delete x.lessons[String(n)];
          else x.lessons[String(n)] = next;
        })
      }
    >
      <span class="lesson-n">{n}</span>
      <span class="lesson-st">{st === 2 ? '✓' : st === 1 ? '…' : ''}</span>
    </button>
  );
}
