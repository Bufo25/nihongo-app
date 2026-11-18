import { Header, Icon, type IconName } from '../ui.tsx';

const ITEMS: { href: string; icon: IconName; title: string; sub: string }[] = [
  { href: '#/streak', icon: 'fire', title: 'Серия дней', sub: 'Календарь с крестиками' },
  { href: '#/diary', icon: 'pen', title: 'Дневник', sub: '1–2 предложения на японском' },
  { href: '#/checkpoints', icon: 'flag', title: 'Чекпоинты', sub: 'Итоги каждого месяца' },
  { href: '#/review', icon: 'chat', title: 'Разбор недели', sub: 'Три вопроса в выходной' },
  { href: '#/resources', icon: 'link', title: 'Ресурсы', sub: 'Ссылки из плана' },
  { href: '#/settings', icon: 'gear', title: 'Настройки', sub: 'Google Drive, Anki, напоминание, установка' },
];

export function More() {
  return (
    <div class="page">
      <Header title="Ещё" />
      <ul class="res-list card">
        {ITEMS.map((i) => (
          <li>
            <a href={i.href}>
              <span class="more-icon">
                <Icon name={i.icon} />
              </span>
              <span>
                <b>{i.title}</b>
                <span class="muted small-text">{i.sub}</span>
              </span>
              <Icon name="chev" size={18} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
