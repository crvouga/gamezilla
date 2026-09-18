#!/usr/bin/env bun
import { spawn } from 'node:child_process';
// @io-wall-ok — composition root
/**
 * Lighthouse CI harness for low-end Android mobile-web gates.
 *
 * Rebuilds the client when baked `VITE_API_URL` ≠ preview origin, then serves
 * dist with `/api` proxied to a local stub (same-origin under COEP).
 *
 * Memory: each route is collected in its own LHCI process so headless Chrome
 * cannot accumulate across `/` → `/more` → `/profile`. Orphan headless Chrome
 * is reaped between routes; a single SIGKILL retry is allowed after reap.
 * Thresholds / iterations / routes live in `perf-budget.json`.
 *
 * usage: lighthouse-ci.ts --budget=<perf-budget.json> [--dist=<dir>] [--skip-upload]
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { assertFirstLoadApiBytes } from './check-first-load-api-budget';
import { startPerfApiStub } from './lighthouse-api-stub';
import {
  assertRouteMetrics,
  findBannedFetches,
  type LhrLike,
  mediansFromLhrs,
} from './lighthouse-report';
import {
  loadPerfBudget,
  type PerfBudget,
  parseBudgetPath,
  printCheckVerdict,
  reportGate,
} from './perf-budget';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const CLIENT_DIR = join(REPO_ROOT, 'apps/client');
const DEFAULT_DIST = join(CLIENT_DIR, 'dist');
const LHCI_OUT = join(CLIENT_DIR, '.lighthouseci');
/** Survives LHCI wiping `LHCI_OUT` between per-route autoruns. */
const LHCI_COLLECTED = join(LHCI_OUT, 'collected');
const LHCI_CONFIG = join(LHCI_OUT, 'lighthouserc.json');
/** Prefer localhost — client normalizes 127.0.0.1 → localhost for cookies. */
const PREVIEW_HOST = 'localhost';
const PREVIEW_PORT = 5177;
const STUB_PORT = 8799;

/**
 * Chrome flags that cut LHCI RAM without changing audited metrics (still Slow
 * 4G + 4× CPU + mobile emulation from the budget).
 */
const CHROME_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--mute-audio',
  '--metrics-recording-only',
  '--no-first-run',
  '--no-default-browser-check',
].join(' ');

type LhciExit = {
  readonly code: number;
  readonly sigkill: boolean;
};

function argValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function waitPort(origin: string, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(origin);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await Bun.sleep(200);
  }
  throw new Error(`server not ready: ${origin}`);
}

const PREVIEW_ORIGIN_RE = /\[preview-server\] static web=(https?:\/\/\S+)/;

async function startPreview(args: {
  readonly preferredPort: number;
  readonly apiOrigin: string;
}): Promise<{ stop: () => void; origin: string }> {
  const preferredOrigin = `http://${PREVIEW_HOST}:${String(args.preferredPort)}`;
  const proc = spawn('bun', [join(CLIENT_DIR, 'scripts/preview-server.ts')], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      PREVIEW_PORT: String(args.preferredPort),
      VITE_API_URL: preferredOrigin,
      LOCAL_PREVIEW_API_ORIGIN: args.apiOrigin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr?.on('data', (chunk: Buffer | string) => {
    process.stderr.write(chunk);
  });
  const origin = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let buf = '';
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };
    const onData = (chunk: Buffer | string): void => {
      buf += typeof chunk === 'string' ? chunk : chunk.toString();
      const matched = PREVIEW_ORIGIN_RE.exec(buf)?.[1];
      if (matched !== undefined) {
        proc.stdout?.off('data', onData);
        finish(() => resolve(matched));
      }
    };
    proc.stdout?.on('data', onData);
    proc.once('error', (err) => finish(() => reject(err)));
    proc.once('exit', (code) => {
      finish(() =>
        reject(
          new Error(
            `preview-server exited before ready (code=${String(code ?? 'null')})`
          )
        )
      );
    });
  });
  return {
    origin,
    stop: () => {
      proc.kill('SIGTERM');
    },
  };
}

function writeLighthouserc(args: {
  readonly budget: PerfBudget;
  readonly urls: readonly string[];
  readonly outPath: string;
  readonly skipUpload: boolean;
}): void {
  const cfg = {
    ci: {
      collect: {
        numberOfRuns: args.budget.lighthouse.iterations,
        url: [...args.urls],
        settings: {
          formFactor: 'mobile',
          throttlingMethod: 'simulate',
          onlyCategories: ['performance'],
          chromeFlags: CHROME_FLAGS,
          throttling: {
            rttMs: 150,
            throughputKbps: 1638.4,
            requestLatencyMs: 150,
            downloadThroughputKbps: 1638.4,
            uploadThroughputKbps: 675,
            cpuSlowdownMultiplier: args.budget.lighthouse.cpuSlowdownMultiplier,
          },
          screenEmulation: {
            mobile: true,
            width: 412,
            height: 823,
            deviceScaleFactor: 1.75,
            disabled: false,
          },
        },
      },
      upload: args.skipUpload
        ? { target: 'filesystem', outputDir: LHCI_OUT }
        : { target: 'temporary-public-storage' },
    },
  };
  writeFileSync(args.outPath, `${JSON.stringify(cfg, null, 2)}\n`);
}

function loadLhrs(dir: string): LhrLike[] {
  if (!existsSync(dir)) return [];
  const out: LhrLike[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('lhr-') || !name.endsWith('.json')) continue;
    out.push(JSON.parse(readFileSync(join(dir, name), 'utf8')) as LhrLike);
  }
  return out;
}

function clearPriorLhrs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (
      name.startsWith('lhr-') ||
      name.endsWith('.report.json') ||
      name.endsWith('.report.html') ||
      name === 'lighthouserc.json' ||
      name.startsWith('lighthouserc.') ||
      name === 'collected'
    ) {
      rmSync(join(dir, name), { force: true, recursive: true });
    }
  }
}

/** LHCI filesystem upload replaces prior LHRs; stash them before the next route. */
function stashRouteLhrs(routeIndex: number): number {
  mkdirSync(LHCI_COLLECTED, { recursive: true });
  let moved = 0;
  if (!existsSync(LHCI_OUT)) return 0;
  for (const name of readdirSync(LHCI_OUT)) {
    if (!name.startsWith('lhr-') || !name.endsWith('.json')) continue;
    const dest = join(
      LHCI_COLLECTED,
      `lhr-r${String(routeIndex)}-${String(moved)}.json`
    );
    renameSync(join(LHCI_OUT, name), dest);
    moved += 1;
  }
  return moved;
}

function routeIdForUrl(
  budget: PerfBudget,
  url: string
): { id: string; path: string } {
  const u = new URL(url);
  for (const r of budget.lighthouse.routes) {
    if (u.pathname === r.path) return r;
  }
  return { id: 'default', path: u.pathname };
}

/** Reap LHCI / puppeteer headless Chrome only — never the user's interactive Chrome. */
async function reapHeadlessChrome(): Promise<void> {
  await new Promise<void>((resolve) => {
    const proc = spawn(
      'pkill',
      [
        '-f',
        'chrome-headless-shell|--headless(=new)?.*(remote-debugging|user-data-dir)|Chromium.*--headless|Chrome for Testing.*--headless',
      ],
      { stdio: 'ignore' }
    );
    proc.on('exit', () => resolve());
    proc.on('error', () => resolve());
  });
  await Bun.sleep(400);
}

function lhciChildEnv(): NodeJS.ProcessEnv {
  const prior = process.env['NODE_OPTIONS'] ?? '';
  const heap = '--max-old-space-size=4096';
  const nodeOptions = prior.includes('max-old-space-size')
    ? prior
    : `${prior} ${heap}`.trim();
  return { ...process.env, NODE_OPTIONS: nodeOptions };
}

async function runLhci(configPath: string): Promise<LhciExit> {
  const proc = spawn(
    'bunx',
    ['--bun', '@lhci/cli@0.14.0', 'autorun', `--config=${configPath}`],
    { cwd: CLIENT_DIR, stdio: 'inherit', env: lhciChildEnv() }
  );
  return await new Promise((resolve) => {
    proc.on('exit', (code, signal) => {
      const sigkill = signal === 'SIGKILL' || code === 137;
      resolve({ code: code ?? (sigkill ? 137 : 1), sigkill });
    });
    proc.on('error', () => resolve({ code: 1, sigkill: false }));
  });
}

/**
 * One LHCI process per URL so Chrome cannot retain heap across routes.
 * On SIGKILL, reap orphans and retry that URL once (same iterations / budgets).
 */
async function collectPerRoute(args: {
  readonly budget: PerfBudget;
  readonly urls: readonly string[];
  readonly skipUpload: boolean;
}): Promise<number> {
  let worstCode = 0;
  let routeIndex = 0;
  for (const url of args.urls) {
    const runs = String(args.budget.lighthouse.iterations);
    console.log(`[lighthouse] collecting ${url} (${runs} run(s))`);
    writeLighthouserc({
      budget: args.budget,
      urls: [url],
      outPath: LHCI_CONFIG,
      skipUpload: args.skipUpload,
    });
    let result = await runLhci(LHCI_CONFIG);
    if (result.sigkill) {
      console.warn(
        `[lighthouse] SIGKILL while collecting ${url} — reaping headless Chrome and retrying once`
      );
      await reapHeadlessChrome();
      result = await runLhci(LHCI_CONFIG);
    }
    if (result.code !== 0) {
      worstCode = result.code;
    }
    const stashed = stashRouteLhrs(routeIndex);
    console.log(`[lighthouse] stashed ${String(stashed)} LHR(s) for ${url}`);
    routeIndex += 1;
    await reapHeadlessChrome();
  }
  return worstCode;
}

function assertAll(
  budget: PerfBudget,
  lhrs: readonly LhrLike[]
): { warnCount: number; failCount: number } {
  let warnCount = 0;
  let failCount = 0;
  const tally = (r: 'ok' | 'warn' | 'fail'): void => {
    if (r === 'warn') warnCount += 1;
    if (r === 'fail') failCount += 1;
  };

  const byPath = new Map<string, LhrLike[]>();
  for (const lhr of lhrs) {
    const url = lhr.finalUrl ?? lhr.requestedUrl ?? '';
    const { path } = routeIdForUrl(budget, url);
    const list = byPath.get(path) ?? [];
    list.push(lhr);
    byPath.set(path, list);
  }

  for (const route of budget.lighthouse.routes) {
    const group = byPath.get(route.path) ?? [];
    if (group.length === 0) {
      tally(
        reportGate({
          tag: 'lighthouse',
          mode: budget.lighthouse.mode,
          over: true,
          message: `no LHR for route ${route.path}`,
        })
      );
      continue;
    }
    const medians = mediansFromLhrs(group);
    const metrics =
      route.id === 'shell'
        ? budget.lighthouse.metrics.shell
        : budget.lighthouse.metrics.default;
    for (const msg of assertRouteMetrics({
      routeId: route.id,
      path: route.path,
      medians,
      budget: metrics,
    })) {
      tally(
        reportGate({
          tag: 'lighthouse',
          mode: budget.lighthouse.mode,
          over: true,
          message: msg,
        })
      );
    }

    if (route.id === 'shell') {
      const banned = findBannedFetches({
        lhr: group[0] ?? {},
        patterns: budget.lighthouse.bannedFetchBeforeInteraction,
      });
      for (const bannedUrl of banned) {
        tally(
          reportGate({
            tag: 'lighthouse',
            mode: budget.lighthouse.mode,
            over: true,
            message: `banned fetch before LCP on /: ${bannedUrl}`,
          })
        );
      }
    }
  }
  return { warnCount, failCount };
}

function distBakesApiOrigin(distDir: string, apiOrigin: string): boolean {
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) return false;
  const html = readFileSync(indexPath, 'utf8');
  const match = /src="(\/assets\/[^"]+\.js)"/.exec(html);
  if (match === null || match[1] === undefined) return false;
  const entry = join(distDir, match[1].slice(1));
  if (!existsSync(entry)) return false;
  return readFileSync(entry, 'utf8').includes(apiOrigin);
}

async function ensureClientBuild(
  distDir: string,
  apiOrigin: string
): Promise<void> {
  if (distBakesApiOrigin(distDir, apiOrigin)) {
    console.log(`[lighthouse] dist already targets ${apiOrigin}`);
    return;
  }
  console.log(
    `[lighthouse] building @apps/client with VITE_API_URL=${apiOrigin}`
  );
  const code = await new Promise<number>((resolve) => {
    const proc = spawn('bun', ['run', 'build'], {
      cwd: CLIENT_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_URL: apiOrigin,
      },
    });
    proc.on('exit', (c) => resolve(c ?? 1));
  });
  if (code !== 0 || !existsSync(join(distDir, 'index.html'))) {
    console.error('[lighthouse] client build failed; cannot run Lighthouse');
    process.exit(1);
  }
  if (!distBakesApiOrigin(distDir, apiOrigin)) {
    console.error(
      `[lighthouse] build finished but entry JS does not contain ${apiOrigin}`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const budgetRel = parseBudgetPath(argv);
  const budgetAbs = budgetRel.startsWith('/')
    ? budgetRel
    : join(process.cwd(), budgetRel);
  const budget = loadPerfBudget(budgetAbs);
  const distDir = argValue(argv, '--dist') ?? DEFAULT_DIST;
  const skipUpload = argv.includes('--skip-upload');

  mkdirSync(LHCI_OUT, { recursive: true });
  clearPriorLhrs(LHCI_OUT);
  await reapHeadlessChrome();

  const api = startPerfApiStub(STUB_PORT);
  const preferredPreviewOrigin = `http://${PREVIEW_HOST}:${String(PREVIEW_PORT)}`;
  await ensureClientBuild(distDir, preferredPreviewOrigin);
  const preview = await startPreview({
    preferredPort: PREVIEW_PORT,
    apiOrigin: api.origin,
  });
  if (preview.origin !== preferredPreviewOrigin) {
    await ensureClientBuild(distDir, preview.origin);
  }

  try {
    await waitPort(preview.origin, 15_000);
    const urls = budget.lighthouse.routes.map(
      (r) => `${preview.origin}${r.path}`
    );
    const code = await collectPerRoute({
      budget,
      urls,
      skipUpload,
    });
    const lhrs = loadLhrs(LHCI_COLLECTED);
    const asserted = assertAll(budget, lhrs);
    const apiResult = assertFirstLoadApiBytes({
      totalBytes: api.totalResponseBytes(),
      budgetKb: budget.firstLoadApi.totalGzipKb,
      mode: budget.firstLoadApi.mode,
    });
    let warnCount = asserted.warnCount;
    let failCount = asserted.failCount;
    if (apiResult === 'warn') warnCount += 1;
    if (apiResult === 'fail') failCount += 1;
    if (lhrs.length === 0) {
      const empty = reportGate({
        tag: 'lighthouse',
        mode: budget.lighthouse.mode,
        over: true,
        message:
          'collected 0 LHR(s) — page never painted (NO_FCP) or LHCI failed',
      });
      if (empty === 'warn') warnCount += 1;
      if (empty === 'fail') failCount += 1;
    }
    if (code !== 0 && budget.lighthouse.mode === 'error') {
      failCount += 1;
    } else if (code !== 0) {
      warnCount += 1;
      console.warn(
        `[lighthouse] WARN: lhci exited ${String(code)} (mode=warn)`
      );
    }
    printCheckVerdict({
      tag: 'lighthouse',
      mode: budget.lighthouse.mode,
      warnCount,
      failCount,
      extra: `${String(lhrs.length)} LHR(s)`,
    });
  } finally {
    preview.stop();
    api.stop();
    await reapHeadlessChrome();
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
