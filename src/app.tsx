import { useEffect, useState } from 'preact/hooks';
import { useAppState, useToday } from './store.ts';
import { Today } from './screens/Today.tsx';
import { Streak } from './screens/Streak.tsx';
import { PlanScreen } from './screens/Plan.tsx';
import { Checkpoints } from './screens/Checkpoints.tsx';
import { ReviewScreen } from './screens/Review.tsx';
import { Diary } from './screens/Diary.tsx';
import { Resources } from './screens/Resources.tsx';
import { Settings } from './screens/Settings.tsx';
import { More } from './screens/More.tsx';
import { Kana } from './screens/Kana.tsx';
import { ProgressScreen } from './screens/Progress.tsx';
import { Stats } from './screens/Stats.tsx';
import { Reader } from './screens/Reader.tsx';
import { Icon, type IconName } from './ui.tsx';
import { useUpdateAvailable } from './update.ts';
import { TimerBar } from './screens/TimerBar.tsx';

export type Route = 'today' | 'streak' | 'plan' | 'progress' | 'stats' | 'kana' | 'reader' | 'checkpoints' | 'review' | 'diary' | 'resources' | 'settings' | 'more';

interface NavItem {
  r: Route;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { r: 'today', label: 'Сегодня', icon: 'today' },
  { r: 'streak', label: 'Серия', icon: 'fire' },
  { r: 'plan', label: 'План', icon: 'map' },
  { r: 'progress', label: 'Прогресс', icon: 'chart' },
  { r: 'stats', label: 'Статистика', icon: 'stats' },
  { r: 'kana', label: 'Тренажёр каны', icon: 'kana' },
  { r: 'reader', label: 'Читалка', icon: 'book' },
  { r: 'checkpoints', label: 'Чекпоинты', icon: 'flag' },
  { r: 'review', label: 'Разбор недели', icon: 'chat' },
  { r: 'diary', label: 'Дневник', icon: 'pen' },
  { r: 'resources', label: 'Ресурсы', icon: 'link' },
  { r: 'settings', label: 'Настройки', icon: 'gear' },
];

const byRoute = (r: Route) => NAV.find((n) => n.r === r)!;

const MOBILE_NAV: NavItem[] = [
  byRoute('today'),
  byRoute('plan'),
  { ...byRoute('kana'), label: 'Кана' },
  byRoute('progress'),
  { r: 'more', label: 'Ещё', icon: 'more' },
];

const MORE_ROUTES: Route[] = ['streak', 'stats', 'reader', 'checkpoints', 'review', 'diary', 'resources', 'settings', 'more'];

function readRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '').split('/')[0] as Route;
  return [...NAV.map((n) => n.r), 'more'].includes(h) ? h : 'today';
}

/** Второй сегмент адреса: #/reader/<id> → <id>. */
function readParam(): string | null {
  return decodeURIComponent(location.hash.replace(/^#\/?/, '').split('/')[1] ?? '') || null;
}

export function go(r: Route) {
  location.hash = `#/${r}`;
}

export function App() {
  const s = useAppState();
  const today = useToday();
  const [route, setRoute] = useState<Route>(readRoute());
  const [param, setParam] = useState<string | null>(readParam());

  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      setParam(readParam());
      document.getElementById('main')?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const props = { s, today };
  let screen;
  switch (route) {
    case 'streak': screen = <Streak {...props} />; break;
    case 'plan': screen = <PlanScreen {...props} />; break;
    case 'progress': screen = <ProgressScreen {...props} />; break;
    case 'stats': screen = <Stats {...props} />; break;
    case 'kana': screen = <Kana {...props} />; break;
    case 'reader': screen = <Reader s={s} param={param} />; break;
    case 'checkpoints': screen = <Checkpoints {...props} />; break;
    case 'review': screen = <ReviewScreen {...props} />; break;
    case 'diary': screen = <Diary {...props} />; break;
    case 'resources': screen = <Resources />; break;
    case 'settings': screen = <Settings {...props} />; break;
    case 'more': screen = <More />; break;
    default: screen = <Today {...props} />;
  }

  return (
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark" lang="ja">あ</span>
          <span>Японский с нуля</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <a href={`#/${n.r}`} class={route === n.r ? 'active' : ''} aria-current={route === n.r ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </nav>
      </aside>
      <main id="main">
        <UpdateBanner />
        {screen}
        <TimerBar />
      </main>
      <nav class="tabbar">
        {MOBILE_NAV.map((n) => {
          const active = n.r === 'more' ? MORE_ROUTES.includes(route) : route === n.r;
          return (
            <a href={`#/${n.r}`} class={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function UpdateBanner() {
  const available = useUpdateAvailable();
  if (!available) return null;
  return (
    <div class="update-banner" role="status">
      <span>Вышла новая версия приложения.</span>
      <button class="btn primary small" onClick={() => location.reload()}>
        Обновить
      </button>
    </div>
  );
}
