#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Shared loader + types for apps/client/perf-budget.json (schema v2).
 */
import { readFileSync } from 'node:fs';

export type GateMode = 'warn' | 'error';

export type LighthouseRouteMetrics = {
  readonly lcpMs: number;
  readonly tbtMs: number;
  readonly ttiMs: number;
  readonly speedIndexMs: number;
  readonly totalByteWeightKb: number;
  readonly cls: number;
};

export type PerfBudget = {
  readonly version: 2;
  readonly compression: {
    readonly primary: 'gzip' | 'brotli';
    readonly alsoReport: readonly ('gzip' | 'brotli')[];
  };
  readonly initial: {
    readonly jsGzipKb: number;
    readonly cssGzipKb: number;
    readonly fontsKb: number;
    readonly criticalPathTotalGzipKb: number;
    readonly jsRawKb: number;
    readonly imagesRawKb: number;
    readonly perImageRawKb: number;
  };
  readonly lazy: {
    readonly defaultGzipKb: number;
    readonly overrides: Readonly<Record<string, number>>;
  };
  readonly deferredPathMustNotMatch: readonly string[];
  readonly criticalPath: {
    readonly eagerDynamicImportMode: GateMode;
  };
  readonly lighthouse: {
    readonly mode: GateMode;
    readonly iterations: number;
    readonly cpuSlowdownMultiplier: number;
    readonly throttlingPreset: string;
    readonly routes: readonly { readonly id: string; readonly path: string }[];
    readonly metrics: {
      readonly shell: LighthouseRouteMetrics;
      readonly default: LighthouseRouteMetrics;
    };
    readonly bannedFetchBeforeInteraction: readonly string[];
  };
  readonly thirdParty: {
    readonly indexHtmlScriptAllowlist: readonly string[];
    readonly maxBlockingMs: number;
  };
  readonly fonts: {
    readonly allowedFontDisplay: readonly string[];
    readonly preferSystemStack: boolean;
  };
  readonly memory: {
    readonly mode: GateMode;
    readonly shellJsHeapMb: number;
    readonly afterNavJsHeapMb: number;
  };
  readonly firstLoadApi: {
    readonly mode: GateMode;
    readonly totalGzipKb: number;
  };
  readonly serviceWorker: {
    readonly precacheWarnKb: number;
  };
  readonly pwaChrome: {
    readonly splashTotalWarnMb: number;
  };
  readonly images: {
    readonly mode: GateMode;
    readonly assetPngJpegMaxRawKb: number;
    readonly assetHardMaxRawKb: number;
  };
};

function requirePositive(path: string, n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(`bad budget.${path}`);
  }
  return n;
}

function requireMode(path: string, v: unknown): GateMode {
  if (v !== 'warn' && v !== 'error') {
    throw new Error(`bad budget.${path} (expected warn|error)`);
  }
  return v;
}

function requireMetrics(path: string, raw: unknown): LighthouseRouteMetrics {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`bad budget.${path}`);
  }
  const o = raw as Record<string, unknown>;
  return {
    lcpMs: requirePositive(`${path}.lcpMs`, o['lcpMs']),
    tbtMs: requirePositive(`${path}.tbtMs`, o['tbtMs']),
    ttiMs: requirePositive(`${path}.ttiMs`, o['ttiMs']),
    speedIndexMs: requirePositive(`${path}.speedIndexMs`, o['speedIndexMs']),
    totalByteWeightKb: requirePositive(
      `${path}.totalByteWeightKb`,
      o['totalByteWeightKb']
    ),
    cls: requirePositive(`${path}.cls`, o['cls']),
  };
}

type RawSection = Record<string, unknown>;

type RawSections = {
  readonly compression: RawSection;
  readonly initial: RawSection;
  readonly lazy: RawSection;
  readonly criticalPath: RawSection;
  readonly lighthouse: RawSection;
  readonly thirdParty: RawSection;
  readonly fonts: RawSection;
  readonly memory: RawSection;
  readonly firstLoadApi: RawSection;
  readonly serviceWorker: RawSection;
  readonly pwaChrome: RawSection;
  readonly images: RawSection;
};

const CORE_SECTIONS = ['compression', 'initial', 'lazy'] as const;

const OPTIONAL_SECTIONS = [
  'criticalPath',
  'lighthouse',
  'thirdParty',
  'fonts',
  'memory',
  'firstLoadApi',
  'serviceWorker',
  'pwaChrome',
  'images',
] as const;

function isSection(value: unknown): value is RawSection {
  return value !== null && typeof value === 'object';
}

function requireSections(raw: Record<string, unknown>): RawSections {
  for (const key of CORE_SECTIONS) {
    if (!isSection(raw[key])) {
      throw new Error('bad budget: missing compression|initial|lazy');
    }
  }
  for (const key of OPTIONAL_SECTIONS) {
    if (!isSection(raw[key])) {
      throw new Error('bad budget: missing required v2 sections');
    }
  }
  return {
    compression: raw['compression'] as RawSection,
    initial: raw['initial'] as RawSection,
    lazy: raw['lazy'] as RawSection,
    criticalPath: raw['criticalPath'] as RawSection,
    lighthouse: raw['lighthouse'] as RawSection,
    thirdParty: raw['thirdParty'] as RawSection,
    fonts: raw['fonts'] as RawSection,
    memory: raw['memory'] as RawSection,
    firstLoadApi: raw['firstLoadApi'] as RawSection,
    serviceWorker: raw['serviceWorker'] as RawSection,
    pwaChrome: raw['pwaChrome'] as RawSection,
    images: raw['images'] as RawSection,
  };
}

function requireDeferredPatterns(raw: Record<string, unknown>): string[] {
  const deferred = raw['deferredPathMustNotMatch'];
  if (!Array.isArray(deferred)) {
    throw new Error('bad budget.deferredPathMustNotMatch');
  }
  return deferred as string[];
}

function requireLazyOverrides(raw: RawSection): Record<string, number> {
  const overridesRaw = raw['overrides'];
  const overrides: Record<string, number> = {};
  if (overridesRaw !== null && typeof overridesRaw === 'object') {
    for (const [k, v] of Object.entries(
      overridesRaw as Record<string, unknown>
    )) {
      overrides[k] = requirePositive(`lazy.overrides.${k}`, v);
    }
  }
  return overrides;
}

function compressionSection(raw: RawSection): PerfBudget['compression'] {
  return {
    primary: raw['primary'] === 'brotli' ? 'brotli' : 'gzip',
    alsoReport: Array.isArray(raw['alsoReport'])
      ? (raw['alsoReport'] as ('gzip' | 'brotli')[])
      : ['brotli'],
  };
}

function initialSection(raw: RawSection): PerfBudget['initial'] {
  return {
    jsGzipKb: requirePositive('initial.jsGzipKb', raw['jsGzipKb']),
    cssGzipKb: requirePositive('initial.cssGzipKb', raw['cssGzipKb']),
    fontsKb: requirePositive('initial.fontsKb', raw['fontsKb']),
    criticalPathTotalGzipKb: requirePositive(
      'initial.criticalPathTotalGzipKb',
      raw['criticalPathTotalGzipKb']
    ),
    jsRawKb: requirePositive('initial.jsRawKb', raw['jsRawKb']),
    imagesRawKb: requirePositive('initial.imagesRawKb', raw['imagesRawKb']),
    perImageRawKb: requirePositive(
      'initial.perImageRawKb',
      raw['perImageRawKb']
    ),
  };
}

function criticalPathSection(raw: RawSection): PerfBudget['criticalPath'] {
  return {
    eagerDynamicImportMode: requireMode(
      'criticalPath.eagerDynamicImportMode',
      raw['eagerDynamicImportMode']
    ),
  };
}

function lighthouseSection(raw: RawSection): PerfBudget['lighthouse'] {
  const metrics = raw['metrics'];
  if (!isSection(metrics)) {
    throw new Error('bad budget.lighthouse.metrics');
  }
  const routes = raw['routes'];
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('bad budget.lighthouse.routes');
  }
  const banned = raw['bannedFetchBeforeInteraction'];
  return {
    mode: requireMode('lighthouse.mode', raw['mode']),
    iterations: requirePositive('lighthouse.iterations', raw['iterations']),
    cpuSlowdownMultiplier: requirePositive(
      'lighthouse.cpuSlowdownMultiplier',
      raw['cpuSlowdownMultiplier']
    ),
    throttlingPreset: String(raw['throttlingPreset'] ?? 'slow4G'),
    routes: routes as { id: string; path: string }[],
    metrics: {
      shell: requireMetrics('lighthouse.metrics.shell', metrics['shell']),
      default: requireMetrics('lighthouse.metrics.default', metrics['default']),
    },
    bannedFetchBeforeInteraction: Array.isArray(banned)
      ? (banned as string[])
      : [],
  };
}

function thirdPartySection(raw: RawSection): PerfBudget['thirdParty'] {
  const allowlist = raw['indexHtmlScriptAllowlist'];
  return {
    indexHtmlScriptAllowlist: Array.isArray(allowlist)
      ? (allowlist as string[])
      : [],
    maxBlockingMs: requirePositive(
      'thirdParty.maxBlockingMs',
      raw['maxBlockingMs']
    ),
  };
}

function fontsSection(raw: RawSection): PerfBudget['fonts'] {
  const display = raw['allowedFontDisplay'];
  return {
    allowedFontDisplay: Array.isArray(display)
      ? (display as string[])
      : ['swap', 'optional'],
    preferSystemStack: raw['preferSystemStack'] !== false,
  };
}

function memorySection(raw: RawSection): PerfBudget['memory'] {
  return {
    mode: requireMode('memory.mode', raw['mode']),
    shellJsHeapMb: requirePositive(
      'memory.shellJsHeapMb',
      raw['shellJsHeapMb']
    ),
    afterNavJsHeapMb: requirePositive(
      'memory.afterNavJsHeapMb',
      raw['afterNavJsHeapMb']
    ),
  };
}

function firstLoadApiSection(raw: RawSection): PerfBudget['firstLoadApi'] {
  return {
    mode: requireMode('firstLoadApi.mode', raw['mode']),
    totalGzipKb: requirePositive(
      'firstLoadApi.totalGzipKb',
      raw['totalGzipKb']
    ),
  };
}

function serviceWorkerSection(raw: RawSection): PerfBudget['serviceWorker'] {
  return {
    precacheWarnKb: requirePositive(
      'serviceWorker.precacheWarnKb',
      raw['precacheWarnKb']
    ),
  };
}

function pwaChromeSection(raw: RawSection): PerfBudget['pwaChrome'] {
  return {
    splashTotalWarnMb: requirePositive(
      'pwaChrome.splashTotalWarnMb',
      raw['splashTotalWarnMb']
    ),
  };
}

function imagesSection(raw: RawSection): PerfBudget['images'] {
  return {
    mode: requireMode('images.mode', raw['mode'] ?? 'warn'),
    assetPngJpegMaxRawKb: requirePositive(
      'images.assetPngJpegMaxRawKb',
      raw['assetPngJpegMaxRawKb']
    ),
    assetHardMaxRawKb: requirePositive(
      'images.assetHardMaxRawKb',
      raw['assetHardMaxRawKb']
    ),
  };
}

export function loadPerfBudget(abs: string): PerfBudget {
  const raw = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  if (raw['version'] !== 2) {
    throw new Error('bad budget.version (expected 2)');
  }
  const sections = requireSections(raw);
  return {
    version: 2,
    compression: compressionSection(sections.compression),
    initial: initialSection(sections.initial),
    lazy: {
      defaultGzipKb: requirePositive(
        'lazy.defaultGzipKb',
        sections.lazy['defaultGzipKb']
      ),
      overrides: requireLazyOverrides(sections.lazy),
    },
    deferredPathMustNotMatch: requireDeferredPatterns(raw),
    criticalPath: criticalPathSection(sections.criticalPath),
    lighthouse: lighthouseSection(sections.lighthouse),
    thirdParty: thirdPartySection(sections.thirdParty),
    fonts: fontsSection(sections.fonts),
    memory: memorySection(sections.memory),
    firstLoadApi: firstLoadApiSection(sections.firstLoadApi),
    serviceWorker: serviceWorkerSection(sections.serviceWorker),
    pwaChrome: pwaChromeSection(sections.pwaChrome),
    images: imagesSection(sections.images),
  };
}

export function parseBudgetPath(argv: readonly string[]): string {
  const flag = argv.find((a) => a.startsWith('--budget='));
  if (flag === undefined) {
    throw new Error('missing --budget=<perf-budget.json>');
  }
  return flag.slice('--budget='.length);
}

export function kb(bytes: number): number {
  return bytes / 1024;
}

export function reportGate(args: {
  readonly tag: string;
  readonly mode: GateMode;
  readonly over: boolean;
  readonly message: string;
}): 'ok' | 'warn' | 'fail' {
  if (!args.over) {
    console.log(`[${args.tag}] OK: ${args.message}`);
    return 'ok';
  }
  const line = `[${args.tag}] ${args.mode === 'warn' ? 'WARN' : 'FAIL'}: ${args.message}`;
  if (args.mode === 'warn') {
    console.warn(line);
    if (process.env['GITHUB_ACTIONS'] === 'true') {
      console.warn(`::warning::${args.message}`);
    }
    return 'warn';
  }
  console.error(line);
  return 'fail';
}

export function printCheckVerdict(args: {
  readonly tag: string;
  readonly mode: GateMode;
  readonly warnCount: number;
  readonly failCount: number;
  readonly extra?: string | undefined;
}): never {
  const extra = args.extra !== undefined ? ` — ${args.extra}` : '';
  const bar = '═'.repeat(56);
  if (args.failCount > 0) {
    console.error(
      `\n${bar}\n[${args.tag}] RESULT: FAILED\n  failures=${String(args.failCount)}  warnings=${String(args.warnCount)}  mode=${args.mode}${extra}\n${bar}\n`
    );
    process.exit(1);
  }
  if (args.warnCount > 0) {
    console.warn(
      `\n${bar}\n[${args.tag}] RESULT: PASSED WITH WARNINGS\n  warnings=${String(args.warnCount)}  mode=${args.mode}${extra}\n${bar}\n`
    );
    process.exit(0);
  }
  console.log(
    `\n${bar}\n[${args.tag}] RESULT: PASSED\n  mode=${args.mode}${extra}\n${bar}\n`
  );
  process.exit(0);
}
