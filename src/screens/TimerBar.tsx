import { BLOCK_BY_ID, type BlockId } from '../plan.ts';
import { addMinutes, defaultMinutes, pauseTimer, resumeTimer, startTimer, stopTimer, useFinished, useTimer } from '../timer.ts';

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Плашка таймера внизу экрана — видна на всех экранах, пока идёт занятие. */
export function TimerBar() {
  const t = useTimer();
  const [finished, dismiss] = useFinished();
  if (!t && finished) {
    return (
      <>
      <div class="timer-spacer" />
      <div class="timer-bar done" role="status">
        <span>
          Время вышло — «{BLOCK_BY_ID[finished.block].title}» отмечен ✓
        </span>
        <button class="btn small" onClick={dismiss}>
          Ок
        </button>
      </div>
      </>
    );
  }
  if (!t) return null;
  const title = BLOCK_BY_ID[t.block].title;
  return (
    <>
    <div class="timer-spacer" />
    <div class="timer-bar" role="timer" aria-label={`${title}: осталось ${mmss(t.left)}`}>
      <div class="timer-fill" style={{ width: `${(1 - t.left / t.total) * 100}%` }} />
      <div class="timer-main">
        <span class="timer-title">{title}</span>
        <span class="timer-left">{mmss(t.left)}</span>
      </div>
      <div class="timer-actions">
        {t.running ? (
          <button class="btn small" onClick={pauseTimer}>
            Пауза
          </button>
        ) : (
          <button class="btn small" onClick={resumeTimer}>
            Дальше
          </button>
        )}
        <button class="btn small" onClick={() => addMinutes(5)} aria-label="Добавить 5 минут">
          +5
        </button>
        <button class="btn small primary" onClick={() => stopTimer(true)}>
          Готово
        </button>
        <button class="btn small ghost" onClick={() => stopTimer(false)} aria-label="Остановить без отметки">
          Стоп
        </button>
      </div>
    </div>
    </>
  );
}

/** Кнопка «▶ 15» рядом с блоком на «Сегодня». */
export function TimerStart({ block, disabled }: { block: BlockId; disabled?: boolean }) {
  const t = useTimer();
  if (t?.block === block) return <span class="timer-chip on">идёт</span>;
  const min = defaultMinutes(block);
  return (
    <button
      class="timer-chip"
      disabled={disabled || !!t}
      onClick={() => startTimer(block, min)}
      aria-label={`Запустить таймер «${BLOCK_BY_ID[block].title}» на ${min} минут`}
      title={t ? 'Уже идёт другой таймер' : `Таймер на ${min} мин`}
    >
      ▶ {min}
    </button>
  );
}
