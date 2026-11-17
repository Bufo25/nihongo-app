import { RESOURCES } from '../plan.ts';
import { Header, Icon } from '../ui.tsx';

export function Resources() {
  return (
    <div class="page">
      <Header title="Ресурсы" sub="Один ресурс на задачу. Всё — на русском или полностью на японском." />
      {RESOURCES.map((g) => (
        <section>
          <h2 class="section-title">{g.title}</h2>
          <ul class="res-list card">
            {g.items.map((r) => (
              <li>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <span>
                      <b>{r.name}</b>
                      <span class="muted small-text">{r.note}</span>
                    </span>
                    <Icon name="ext" size={18} />
                  </a>
                ) : (
                  <div>
                    <span>
                      <b>{r.name}</b>
                      <span class="muted small-text">{r.note}</span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
