// Performance measurement: builds to .test-dist, serves on 4399, and drives headless
// Chromium over routes x modes x CPU throttle. Usage: pnpm run perf --out <path> [--runs N]
import { spawn, execSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const PORT = 4399;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MODES = { idle: 30_000, scroll: 15_000 };
const VIEWPORT = { width: 1280, height: 720 };
const THROTTLES = [1, 4];
const METRICS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'];

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const outPath = argValue('--out', 'perf-result.json');
const runs = Number(argValue('--runs', '3'));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const firstProjectSlug = () =>
  readdirSync('src/data/projects')
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => f.replace(/\.mdx?$/, ''))
    .sort()[0];

async function startServer() {
  execSync(`REVIEW_TEST_FIXTURES=1 pnpm exec astro build --outDir .test-dist`, { stdio: 'inherit' });
  const server = spawn(
    'pnpm',
    ['exec', 'astro', 'preview', '--outDir', '.test-dist', '--host', '127.0.0.1', '--port', String(PORT)],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error('preview server did not start');
}

async function scrollLoop(page, durationMs) {
  await page.mouse.move(640, 360);
  const end = Date.now() + durationMs;
  let dir = 1;
  while (Date.now() < end) {
    // ~3s down, ~3s up, repeated
    for (let i = 0; i < 12 && Date.now() < end; i++) {
      await page.mouse.wheel(0, 300 * dir);
      await page.waitForTimeout(250);
    }
    dir = -dir;
  }
}

async function metricsSnapshot(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

async function measureOnce(browser, route, mode, throttle) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('fx-tier-lock', '0');
    } catch {
      /* storage unavailable */
    }
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  let transferredBytes = 0;
  cdp.on('Network.loadingFinished', (e) => (transferredBytes += e.encodedDataLength));

  await page.goto(ORIGIN + route, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const el = document.getElementById('loading-screen');
    return !el || getComputedStyle(el).display === 'none';
  });
  // Total bytes transferred up to the moment #loading-screen is hidden.
  const loadBytes = transferredBytes;

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => {
    window.__perf = { frames: 0, long: 0, last: performance.now(), stop: false };
    const tick = (t) => {
      const p = window.__perf;
      if (p.stop) return;
      if (t - p.last > 50) p.long++;
      p.frames++;
      p.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  let paints = 0;
  cdp.on('Tracing.dataCollected', ({ value }) => {
    for (const ev of value) if (ev.name === 'Paint') paints++;
  });
  const tracingDone = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline'] },
  });
  const before = await metricsSnapshot(cdp);

  if (mode === 'idle') await page.waitForTimeout(MODES.idle);
  else await scrollLoop(page, MODES.scroll);

  const after = await metricsSnapshot(cdp);
  // Close the rAF window right after the metrics window so both cover the same interval.
  const perf = await page.evaluate(() => {
    window.__perf.stop = true;
    return window.__perf;
  });
  await cdp.send('Tracing.end');
  await tracingDone;
  await context.close();

  const result = {
    frameCount: perf.frames,
    longFrameShare: perf.frames ? perf.long / perf.frames : 0,
    paintEvents: paints,
  };
  for (const m of METRICS) result[m] = after[m] - before[m];
  result.transferredBytes = loadBytes;
  return result;
}

function medianOf(samples) {
  const out = {};
  for (const key of Object.keys(samples[0])) out[key] = median(samples.map((s) => s[key]));
  return out;
}

const server = await startServer();
let exitCode = 0;
try {
  const browser = await chromium.launch();
  const chromiumVersion = browser.version();
  const routes = ['/', '/contact', `/projects/${firstProjectSlug()}`];
  const results = {};
  for (const route of routes) {
    for (const mode of Object.keys(MODES)) {
      for (const throttle of THROTTLES) {
        const key = `${route}|${mode}|${throttle}x`;
        const samples = [];
        for (let r = 0; r < runs; r++) samples.push(await measureOnce(browser, route, mode, throttle));
        results[key] = { runs, ...medianOf(samples) };
        console.log(key, JSON.stringify(results[key]));
      }
    }
  }
  await browser.close();
  const output = {
    meta: {
      date: new Date().toISOString(),
      runs,
      aggregate: 'median',
      idleMs: MODES.idle,
      scrollMs: MODES.scroll,
      note: 'Headless Chromium uses software compositing, so absolute paint/frame numbers are not representative of GPU-composited browsers; compare before/after only.',
      longFrameThresholdMs: 50,
      gitSha: execSync('git rev-parse HEAD').toString().trim(),
      chromiumVersion,
      viewport: VIEWPORT,
      cpuThrottleRates: THROTTLES,
      durationFields:
        'TaskDuration, ScriptDuration, LayoutDuration and RecalcStyleDuration are cumulative seconds over the measured window (Performance.getMetrics delta).',
      transferredBytes:
        'Total encoded bytes transferred up to the moment #loading-screen is hidden on the first route load.',
      build: 'REVIEW_TEST_FIXTURES=1 astro build --outDir .test-dist',
    },
    results,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`wrote ${outPath}`);
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
