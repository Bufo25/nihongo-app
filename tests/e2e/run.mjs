// Запуск браузерных тестов: поднимает собранное приложение (vite preview) и прогоняет все *.e2e.cjs по очереди.
// Перед запуском нужна сборка: npm run build.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = 4173;
const only = process.argv[2];

// в сборке нет словаря (локально) — подложить маленький образец, как делает CI с настоящим JMdict
const dist = join(here, '../../dist');
if (!existsSync(join(dist, 'dict/index.json'))) {
  const r = spawnSync(process.execPath, [
    join(here, '../../scripts/build-dict.mjs'),
    '--rus', join(here, '../fixtures/jmdict-rus-mini.json'),
    '--eng', join(here, '../fixtures/jmdict-eng-common-mini.json'),
    '--out', join(dist, 'dict'),
  ], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', cwd: join(here, '../..') });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) return;
    } catch {
      /* ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview не запустился');
}

function run(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [join(here, file)], { stdio: 'inherit', env: { ...process.env, APP_URL: `http://localhost:${port}/` } });
    p.on('exit', (code) => resolve(code === 0));
  });
}

let failed = 0;
try {
  await waitForServer();
  const files = readdirSync(here).filter((f) => f.endsWith('.e2e.cjs') && (!only || f.includes(only))).sort();
  for (const f of files) {
    console.log(`\n=== ${f}`);
    if (!(await run(f))) failed++;
  }
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} набор(ов) упал` : '\nВсе браузерные тесты прошли');
process.exit(failed ? 1 : 0);
