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
import { Icon, type IconName } from './ui.tsx';

export type Route = 'today' | 'streak' | 'plan' | 'checkpoints' | 'review' | 'diary' | 'resources' | 'settings' | 'more';

interface NavItem {
  r: Route;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { r: 'today', label: 'Сегодня', icon: 'today' },
  { r: 'streak', label: 'Серия', icon: 'fire' },
  { r: 'plan', label: 'План', icon: 'map' },
  { r: 'checkpoints', label: 'Чекпоинты', icon: 'flag' },
  { r: 'review', label: 'Разбор недели', icon: 'chat' },
  { r: 'diary', label: 'Дневник', icon: 'pen' },
  { r: 'resources', label: 'Ресурсы', icon: 'link' },
  { r: 'settings', label: 'Настройки', icon: 'gear' },
];

const MOBILE_NAV: NavItem[] = [
  NAV[0],
  NAV[1],
  NAV[2],
  NAV[5],
  { r: 'more', label: 'Ещё', icon: 'more' },
];

const MORE_ROUTES: Route[] = ['checkpoints', 'review', 'resources', 'settings', 'more'];

function readRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '') as Route;
  return [...NAV.map((n) => n.r), 'more'].includes(h) ? h : 'today';
}

export function go(r: Route) {
  location.hash = `#/${r}`;
}

export function App() {
  const s = useAppState();
  const today = useToday();
  const [route, setRoute] = useState<Route>(readRoute());

  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
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
      <main id="main">{screen}</main>
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
