// Исходные данные 3-месячного плана.

export type BlockId = 'kana' | 'anki' | 'wagotabi' | 'textbook' | 'shadowing' | 'diary';

export interface Week {
  n: number;
  focus: string;
  tasks: string[];
}

export const WEEKS: Week[] = [
  { n: 1, focus: 'Хирагана', tasks: ['NHK «Простой японский» (на русском), 10–15 знаков в день', 'Каждый знак прописать от руки', 'Тренировка в kana.pro'] },
  { n: 2, focus: 'Хирагана + старт игры', tasks: ['Добить хирагану', 'Начать Wagotabi (включить русский)', 'Поставить Anki и колоду KaishiRu (5–10 новых в день)'] },
  { n: 3, focus: 'Катакана', tasks: ['Катакана в NHK «Простой японский»', 'Повторять аудио к урокам', 'KaishiRu до 10 новых в день'] },
  { n: 4, focus: 'Закрепление', tasks: ['Кана на скорость в kana.pro', 'Клипы Короне, Ботан и Фубуки с переводом'] },
  { n: 5, focus: 'Minna, уроки 1–2', tasks: ['Урок + объяснение в русском пособии', 'Упражнения', 'Первый шэдоуинг'] },
  { n: 6, focus: 'Minna, уроки 3–4', tasks: ['Частицы и глаголы', 'Непонятное — на lingust.ru', 'Не пропускать кандзи'] },
  { n: 7, focus: 'Minna, уроки 5–6', tasks: ['Yomitan с русским JMdict', 'Вародай в закладки'] },
  { n: 8, focus: 'Minna, уроки 7–8 + повтор', tasks: ['Повтор уроков 1–8', 'Первая серия Chi\'s Sweet Home с японскими субтитрами'] },
  { n: 9, focus: 'Minna, уроки 9–10', tasks: ['Первая книжка Tadoku уровня 0', 'Начать дневник'] },
  { n: 10, focus: 'Minna, уроки 11–12', tasks: ['Подкаст Nihongo con Teppei for Beginners'] },
  { n: 11, focus: 'Minna, уроки 13–14', tasks: ['Первый стрим Фубуки или Ботан с автосубтитрами'] },
  { n: 12, focus: 'Повтор + итоги', tasks: ['Повтор уроков 1–14', 'Пробный тест JLPT N5', 'NHK News Web Easy'] },
];

export interface Month {
  n: number;
  title: string;
  checkpoints: string[];
}

export const MONTHS: Month[] = [
  { n: 1, title: 'Кана и привычка', checkpoints: ['Читаю всю хирагану', 'Читаю всю катакану', 'Anki и Wagotabi стали привычкой'] },
  { n: 2, title: 'Грамматика и слова', checkpoints: ['Уроки 1–8', '~400 слов в Anki', 'Первая серия с японскими субтитрами'] },
  { n: 3, title: 'Чтение и погружение', checkpoints: ['Уроки 1–14', 'Первая книжка Tadoku', 'Стрим Hololive с японскими субтитрами', 'Пробный тест N5'] },
];

export const GOAL =
  'Уверенно читать кану, знать ~600–800 слов, пройти уроки 1–14 Minna no Nihongo I и понимать простые видео и стримы с японскими субтитрами.';

export const RULES = [
  'Каждый день — только короткая обязательная часть.',
  'Один ресурс на задачу.',
  'Отставать нормально.',
  'Аниме и Hololive — награда.',
];

export const MISSED_RULES = [
  { when: '1–2 дня', what: 'Просто продолжай.' },
  { when: 'Неделю', what: 'Только Anki и Wagotabi, новые слова на паузу.' },
  { when: 'Больше недели', what: '5 новых карточек в день, вернуться к последнему уроку, который помнишь.' },
];

export interface Block {
  id: BlockId;
  title: string;
  time: string;
  freq: 'daily' | '3x';
  from: number; // с какой недели плана
  until?: number; // по какую неделю включительно
  whenText: string;
}

export const BLOCKS: Block[] = [
  { id: 'kana', title: 'Кана', time: '15–20 мин', freq: 'daily', from: 1, until: 4, whenText: 'Каждый день, месяц 1' },
  { id: 'anki', title: 'Anki', time: '10–15 мин', freq: 'daily', from: 2, whenText: 'Каждый день, с недели 2' },
  { id: 'wagotabi', title: 'Wagotabi', time: '15–20 мин', freq: 'daily', from: 2, whenText: 'Каждый день, с недели 2' },
  { id: 'textbook', title: 'Учебник', time: '30–45 мин', freq: '3x', from: 5, whenText: '3 раза в неделю, с месяца 2' },
  { id: 'shadowing', title: 'Шэдоуинг', time: '5–10 мин', freq: '3x', from: 5, whenText: '3 раза в неделю, с месяца 2' },
  { id: 'diary', title: 'Дневник', time: '5 мин', freq: 'daily', from: 9, whenText: 'Каждый день, с месяца 3' },
];

export const BLOCK_BY_ID = Object.fromEntries(BLOCKS.map((b) => [b.id, b])) as Record<BlockId, Block>;

/** Подсказка, что именно делать в блоке на этой неделе. */
export function blockHint(id: BlockId, week: number): string {
  const w = WEEKS[Math.min(Math.max(week, 1), 12) - 1];
  switch (id) {
    case 'kana':
      return [
        'Хирагана в NHK «Простой японский», 10–15 знаков, прописать от руки, kana.pro',
        'Добить хирагану: NHK + kana.pro',
        'Катакана в NHK «Простой японский», повторить аудио к урокам',
        'Кана на скорость в kana.pro',
      ][Math.min(week, 4) - 1];
    case 'anki':
      return week <= 2 ? 'Повторения + 5–10 новых карточек KaishiRu' : 'Повторения + до 10 новых карточек KaishiRu';
    case 'wagotabi':
      return 'Играть с включённым русским';
    case 'textbook':
      return `${w.focus}: урок + русское пособие, упражнения`;
    case 'shadowing':
      return 'Повторять за диктором аудио к уроку';
    case 'diary':
      return '1–2 предложения на японском';
  }
}

export function badDayText(week: number): string {
  return week >= 2 ? 'Только повторения в Anki — 5 минут' : '5 минут повторить кану';
}

export interface Resource {
  name: string;
  url?: string;
  note: string;
}

export interface ResourceGroup {
  title: string;
  items: Resource[];
}

export const RESOURCES: ResourceGroup[] = [
  {
    title: 'Кана',
    items: [
      { name: 'NHK World «Простой японский»', url: 'https://www.nhk.or.jp/lesson/ru/', note: 'Уроки и кана на русском, с аудио' },
      { name: 'kana.pro', url: 'https://kana.pro/', note: 'Тренажёр каны' },
    ],
  },
  {
    title: 'Слова и привычка',
    items: [
      { name: 'Wagotabi', url: 'https://store.steampowered.com/search/?term=Wagotabi', note: 'Игра для изучения японского, есть русский' },
      { name: 'Anki', url: 'https://apps.ankiweb.net/', note: 'Карточки с интервальными повторениями' },
      { name: 'KaishiRu', url: 'https://github.com/NeonGooRoo/KaishiRu', note: 'Колода Anki с русским переводом' },
    ],
  },
  {
    title: 'Грамматика',
    items: [
      { name: 'Minna no Nihongo I', note: 'Основной учебник + «Перевод и грамматический комментарий» на русском' },
      { name: 'Учебник Нечаевой', note: 'Запасной вариант' },
      { name: 'lingust.ru', url: 'https://lingust.ru/japanese', note: 'Грамматика на русском — когда непонятно' },
    ],
  },
  {
    title: 'Словари и инструменты',
    items: [
      { name: 'Yomitan + JMdict (Russian)', url: 'https://yomitan.wiki/', note: 'Всплывающий словарь в браузере' },
      { name: 'Вародай', url: 'https://warodai.ru/', note: 'Большой японско-русский словарь' },
      { name: 'Яркси', url: 'https://yarxi.ru/', note: 'Словарь кандзи на русском' },
      { name: 'Language Reactor', url: 'https://www.languagereactor.com/', note: 'Двойные субтитры на YouTube и Netflix' },
      { name: 'asbplayer', url: 'https://killergerbah.github.io/asbplayer/', note: 'Плеер с субтитрами для любого видео' },
      { name: 'Jimaku', url: 'https://jimaku.cc/', note: 'Японские субтитры к аниме' },
    ],
  },
  {
    title: 'Слушать и читать',
    items: [
      { name: 'Comprehensible Japanese', url: 'https://cijapanese.com/', note: 'Видео на простом японском' },
      { name: 'Nihongo con Teppei', url: 'https://nihongoconteppei.com/', note: 'Подкаст, начни с for Beginners' },
      { name: 'Tadoku', url: 'https://tadoku.org/japanese/', note: 'Бесплатные книжки по уровням, начни с 0' },
      { name: 'NHK News Web Easy', url: 'https://www3.nhk.or.jp/news/easy/', note: 'Новости на простом японском' },
      { name: 'Hololive', url: 'https://hololive.hololivepro.com/', note: 'Награда: Короне, Ботан, Фубуки' },
    ],
  },
  {
    title: 'Сообщество',
    items: [
      { name: 'nihongoyopta — ВКонтакте', url: 'https://vk.com/nihongoyopta', note: 'Сообщество на русском' },
      { name: 'nihongoyopta — Telegram', url: 'https://t.me/nihongoyopta', note: 'Канал на русском' },
    ],
  },
];

/** Какие ресурсы из списка нужны на неделе (по названию из RESOURCES). */
export const WEEK_RESOURCES: Record<number, string[]> = {
  1: ['NHK World «Простой японский»', 'kana.pro'],
  2: ['NHK World «Простой японский»', 'kana.pro', 'Wagotabi', 'Anki', 'KaishiRu'],
  3: ['NHK World «Простой японский»', 'KaishiRu'],
  4: ['kana.pro', 'Hololive'],
  5: ['lingust.ru'],
  6: ['lingust.ru'],
  7: ['Yomitan + JMdict (Russian)', 'Вародай'],
  8: ['asbplayer', 'Jimaku', 'Language Reactor'],
  9: ['Tadoku'],
  10: ['Nihongo con Teppei'],
  11: ['Hololive', 'Language Reactor'],
  12: ['NHK News Web Easy'],
};

export function weekResources(week: number): Resource[] {
  const all = RESOURCES.flatMap((g) => g.items);
  return (WEEK_RESOURCES[week] ?? []).map((n) => all.find((r) => r.name === n)).filter((r): r is Resource => !!r?.url);
}

export interface DiaryPrompt {
  lesson: number; // 0 — до учебника
  topic: string; // о чём написать
  pattern: string; // конструкция урока
  example: string; // образец
}

/** Подсказки для дневника по урокам Minna no Nihongo I. */
export const DIARY_PROMPTS: DiaryPrompt[] = [
  { lesson: 0, topic: 'Что ты сегодня делал?', pattern: '〜を みました', example: 'きょうは アニメを みました。' },
  { lesson: 0, topic: 'Что тебе нравится?', pattern: '〜が すきです', example: 'わたしは ねこが すきです。' },
  { lesson: 1, topic: 'Представься: кто ты и откуда', pattern: 'わたしは 〜です', example: 'わたしは ロシアじんです。がくせいです。' },
  { lesson: 1, topic: 'Кем ты не являешься?', pattern: '〜じゃ ありません', example: 'わたしは せんせいじゃ ありません。' },
  { lesson: 2, topic: 'Опиши вещь рядом с тобой', pattern: 'これは 〜の 〜です', example: 'これは わたしの ほんです。' },
  { lesson: 3, topic: 'Где что находится у тебя дома?', pattern: '〜は ここ／そこ／あそこです', example: 'トイレは あそこです。' },
  { lesson: 3, topic: 'Сколько стоила вещь?', pattern: '〜は 〜えんです', example: 'この コーヒーは 300えんでした。' },
  { lesson: 4, topic: 'Во сколько ты встал и лёг?', pattern: '〜じに おきます', example: 'けさ 7じに おきました。' },
  { lesson: 4, topic: 'С какого по какое время ты занимался?', pattern: '〜から 〜まで', example: '9じから 5じまで はたらきました。' },
  { lesson: 5, topic: 'Куда ты ходил и с кем?', pattern: '〜へ いきます／〜と', example: 'きのう ともだちと スーパーへ いきました。' },
  { lesson: 5, topic: 'На чём ты ездил?', pattern: '〜で いきます', example: 'でんしゃで かいしゃへ いきました。' },
  { lesson: 6, topic: 'Что ты ел и пил?', pattern: '〜を たべます', example: 'あさ パンを たべました。' },
  { lesson: 6, topic: 'Где ты что делал?', pattern: '〜で 〜を します', example: 'うちで にほんごを べんきょうしました。' },
  { lesson: 6, topic: 'Пригласи кого-нибудь', pattern: '〜ませんか', example: 'いっしょに ゲームを しませんか。' },
  { lesson: 7, topic: 'Что ты кому подарил или получил?', pattern: '〜に あげます／もらいます', example: 'ともだちに ほんを あげました。' },
  { lesson: 7, topic: 'Что уже сделал?', pattern: 'もう 〜ました', example: 'もう しゅくだいを しました。' },
  { lesson: 8, topic: 'Опиши что-нибудь прилагательным', pattern: '〜は 〜い／〜な です', example: 'きょうは さむいです。まちは しずかです。' },
  { lesson: 9, topic: 'Что ты любишь и что умеешь?', pattern: '〜が すきです／じょうずです', example: 'わたしは アニメが すきです。りょうりが へたです。' },
  { lesson: 9, topic: 'Почему?', pattern: '〜から', example: 'じかんが ありませんから、ゲームを しませんでした。' },
  { lesson: 10, topic: 'Что где находится?', pattern: '〜に 〜が あります／います', example: 'へやに ねこが います。' },
  { lesson: 11, topic: 'Посчитай что-нибудь', pattern: '〜つ／〜まい／〜にん', example: 'りんごを みっつ かいました。' },
  { lesson: 11, topic: 'Сколько времени ты потратил?', pattern: '〜じかん', example: 'にほんごを いちじかん べんきょうしました。' },
  { lesson: 12, topic: 'Каким был вчерашний день?', pattern: '〜かったです／〜でした', example: 'きのうは たのしかったです。' },
  { lesson: 12, topic: 'Сравни две вещи', pattern: '〜は 〜より 〜です', example: 'ねこは いぬより かわいいです。' },
  { lesson: 13, topic: 'Чего тебе хочется?', pattern: '〜が ほしいです／〜たいです', example: 'あたらしい パソコンが ほしいです。にほんへ いきたいです。' },
  { lesson: 13, topic: 'Зачем ты куда-то ходил?', pattern: '〜に いきます', example: 'コンビニへ パンを かいに いきました。' },
  { lesson: 14, topic: 'Что ты сейчас делаешь?', pattern: '〜て います', example: 'いま おんがくを きいて います。' },
  { lesson: 14, topic: 'Попроси о чём-нибудь', pattern: '〜て ください', example: 'ゆっくり はなして ください。' },
];

/** Подсказки, которые уже по силам: из пройденных уроков (и урока в процессе). */
export function diaryPromptsUpTo(lesson: number): DiaryPrompt[] {
  return DIARY_PROMPTS.filter((p) => p.lesson <= lesson);
}
