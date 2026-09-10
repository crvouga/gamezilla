#!/usr/bin/env bun
import { spawn } from 'node:child_process';
// @io-wall-ok — tools composition root
/**
 * Lighthouse CI harness for low-end Android mobile-web gates.
 * Requires a prior Vite production build in apps/client/dist.
 *
 * usage: lighthouse-ci.ts --budget=<perf-budget.json> [--dist=<dir>] [--skip-upload]
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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

const REPO_ROOT = join(import.meta.dirname, '../..');
const CLIENT_DIR = join(REPO_ROOT, 'apps/client');
const DEFAULT_DIST = join(CLIENT_DIR, 'dist');
const LHCI_OUT = join(CLIENT_DIR, '.lighthouseci');

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

function startPreview(args: {
  readonly distDir: string;
  readonly port: number;
  readonly apiOrigin: string;
}): { stop: () => void; origin: string } {
  const proc = spawn('bun', [join(CLIENT_DIR, 'scripts/preview-server.ts')], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      PREVIEW_PORT: String(args.port),
      VITE_API_URL: args.apiOrigin,
      LOCAL_PREVIEW_API_ORIGIN: args.apiOrigin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    origin: `http://127.0.0.1:${String(args.port)}`,
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
          throttling: {
            // Slow 4G-ish (LH mobileSlow4G)
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

async function runLhci(configPath: string): Promise<number> {
  const proc = spawn(
    'bunx',
    ['--bun', '@lhci/cli@0.14.0', 'autorun', `--config=${configPath}`],
    { cwd: CLIENT_DIR, stdio: 'inherit', env: process.env }
  );
  return await new Promise((resolve) => {
    proc.on('exit', (code) => resolve(code ?? 1));
  });
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
      for (const url of banned) {
        tally(
          reportGate({
            tag: 'lighthouse',
            mode: budget.lighthouse.mode,
            over: true,
            message: `banned fetch before LCP on /: ${url}`,
          })
        );
      }
    }
  }
  return { warnCount, failCount };
}

async function ensureClientBuild(
  distDir: string,
  apiOrigin: string
): Promise<void> {
  if (existsSync(join(distDir, 'index.html'))) return;
  console.log(
    `[lighthouse] missing ${distDir}/index.html — running @apps/client build (VITE_API_URL=${apiOrigin})`
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
  const api = startPerfApiStub(8799);
  await ensureClientBuild(distDir, api.origin);
  const preview = startPreview({
    distDir,
    port: 5177,
    apiOrigin: api.origin,
  });

  try {
    await waitPort(preview.origin, 15_000);
    const urls = budget.lighthouse.routes.map(
      (r) => `${preview.origin}${r.path}`
    );
    const configPath = join(CLIENT_DIR, 'lighthouserc.json');
    writeLighthouserc({ budget, urls, outPath: configPath, skipUpload });
    const code = await runLhci(configPath);
    const lhrs = loadLhrs(LHCI_OUT);
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
    if (code !== 0 && budget.lighthouse.mode === 'error') {
      failCount += 1;
    } else if (code !== 0) {
      warnCount += 1;
      console.warn(
        `[lighthouse] WARN: lhci autorun exited ${String(code)} (mode=warn)`
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
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
