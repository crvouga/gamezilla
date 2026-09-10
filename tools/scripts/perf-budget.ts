#!/usr/bin/env bun
// @io-wall-ok — tools composition root
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

export function loadPerfBudget(abs: string): PerfBudget {
  const raw = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  if (raw['version'] !== 2) {
    throw new Error('bad budget.version (expected 2)');
  }
  const compression = raw['compression'] as Record<string, unknown> | undefined;
  const initial = raw['initial'] as Record<string, unknown> | undefined;
  const lazy = raw['lazy'] as Record<string, unknown> | undefined;
  const criticalPath = raw['criticalPath'] as
    | Record<string, unknown>
    | undefined;
  const lighthouse = raw['lighthouse'] as Record<string, unknown> | undefined;
  const thirdParty = raw['thirdParty'] as Record<string, unknown> | undefined;
  const fonts = raw['fonts'] as Record<string, unknown> | undefined;
  const memory = raw['memory'] as Record<string, unknown> | undefined;
  const firstLoadApi = raw['firstLoadApi'] as
    | Record<string, unknown>
    | undefined;
  const serviceWorker = raw['serviceWorker'] as
    | Record<string, unknown>
    | undefined;
  const pwaChrome = raw['pwaChrome'] as Record<string, unknown> | undefined;
  const images = raw['images'] as Record<string, unknown> | undefined;

  if (
    compression === undefined ||
    initial === undefined ||
    lazy === undefined
  ) {
    throw new Error('bad budget: missing compression|initial|lazy');
  }
  if (
    lighthouse === undefined ||
    thirdParty === undefined ||
    fonts === undefined ||
    memory === undefined ||
    firstLoadApi === undefined ||
    serviceWorker === undefined ||
    pwaChrome === undefined ||
    images === undefined ||
    criticalPath === undefined
  ) {
    throw new Error('bad budget: missing required v2 sections');
  }

  const deferred = raw['deferredPathMustNotMatch'];
  if (!Array.isArray(deferred)) {
    throw new Error('bad budget.deferredPathMustNotMatch');
  }

  const overridesRaw = lazy['overrides'];
  const overrides: Record<string, number> = {};
  if (overridesRaw !== null && typeof overridesRaw === 'object') {
    for (const [k, v] of Object.entries(
      overridesRaw as Record<string, unknown>
    )) {
      overrides[k] = requirePositive(`lazy.overrides.${k}`, v);
    }
  }

  const lhMetrics = lighthouse['metrics'] as
    | Record<string, unknown>
    | undefined;
  if (lhMetrics === undefined) {
    throw new Error('bad budget.lighthouse.metrics');
  }

  const routes = lighthouse['routes'];
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('bad budget.lighthouse.routes');
  }

  return {
    version: 2,
    compression: {
      primary: compression['primary'] === 'brotli' ? 'brotli' : 'gzip',
      alsoReport: Array.isArray(compression['alsoReport'])
        ? (compression['alsoReport'] as ('gzip' | 'brotli')[])
        : ['brotli'],
    },
    initial: {
      jsGzipKb: requirePositive('initial.jsGzipKb', initial['jsGzipKb']),
      cssGzipKb: requirePositive('initial.cssGzipKb', initial['cssGzipKb']),
      fontsKb: requirePositive('initial.fontsKb', initial['fontsKb']),
      criticalPathTotalGzipKb: requirePositive(
        'initial.criticalPathTotalGzipKb',
        initial['criticalPathTotalGzipKb']
      ),
      jsRawKb: requirePositive('initial.jsRawKb', initial['jsRawKb']),
      imagesRawKb: requirePositive(
        'initial.imagesRawKb',
        initial['imagesRawKb']
      ),
      perImageRawKb: requirePositive(
        'initial.perImageRawKb',
        initial['perImageRawKb']
      ),
    },
    lazy: {
      defaultGzipKb: requirePositive(
        'lazy.defaultGzipKb',
        lazy['defaultGzipKb']
      ),
      overrides,
    },
    deferredPathMustNotMatch: deferred as string[],
    criticalPath: {
      eagerDynamicImportMode: requireMode(
        'criticalPath.eagerDynamicImportMode',
        criticalPath['eagerDynamicImportMode']
      ),
    },
    lighthouse: {
      mode: requireMode('lighthouse.mode', lighthouse['mode']),
      iterations: requirePositive(
        'lighthouse.iterations',
        lighthouse['iterations']
      ),
      cpuSlowdownMultiplier: requirePositive(
        'lighthouse.cpuSlowdownMultiplier',
        lighthouse['cpuSlowdownMultiplier']
      ),
      throttlingPreset: String(lighthouse['throttlingPreset'] ?? 'slow4G'),
      routes: routes as { id: string; path: string }[],
      metrics: {
        shell: requireMetrics('lighthouse.metrics.shell', lhMetrics['shell']),
        default: requireMetrics(
          'lighthouse.metrics.default',
          lhMetrics['default']
        ),
      },
      bannedFetchBeforeInteraction: Array.isArray(
        lighthouse['bannedFetchBeforeInteraction']
      )
        ? (lighthouse['bannedFetchBeforeInteraction'] as string[])
        : [],
    },
    thirdParty: {
      indexHtmlScriptAllowlist: Array.isArray(
        thirdParty['indexHtmlScriptAllowlist']
      )
        ? (thirdParty['indexHtmlScriptAllowlist'] as string[])
        : [],
      maxBlockingMs: requirePositive(
        'thirdParty.maxBlockingMs',
        thirdParty['maxBlockingMs']
      ),
    },
    fonts: {
      allowedFontDisplay: Array.isArray(fonts['allowedFontDisplay'])
        ? (fonts['allowedFontDisplay'] as string[])
        : ['swap', 'optional'],
      preferSystemStack: fonts['preferSystemStack'] !== false,
    },
    memory: {
      mode: requireMode('memory.mode', memory['mode']),
      shellJsHeapMb: requirePositive(
        'memory.shellJsHeapMb',
        memory['shellJsHeapMb']
      ),
      afterNavJsHeapMb: requirePositive(
        'memory.afterNavJsHeapMb',
        memory['afterNavJsHeapMb']
      ),
    },
    firstLoadApi: {
      mode: requireMode('firstLoadApi.mode', firstLoadApi['mode']),
      totalGzipKb: requirePositive(
        'firstLoadApi.totalGzipKb',
        firstLoadApi['totalGzipKb']
      ),
    },
    serviceWorker: {
      precacheWarnKb: requirePositive(
        'serviceWorker.precacheWarnKb',
        serviceWorker['precacheWarnKb']
      ),
    },
    pwaChrome: {
      splashTotalWarnMb: requirePositive(
        'pwaChrome.splashTotalWarnMb',
        pwaChrome['splashTotalWarnMb']
      ),
    },
    images: {
      mode: requireMode('images.mode', images['mode'] ?? 'warn'),
      assetPngJpegMaxRawKb: requirePositive(
        'images.assetPngJpegMaxRawKb',
        images['assetPngJpegMaxRawKb']
      ),
      assetHardMaxRawKb: requirePositive(
        'images.assetHardMaxRawKb',
        images['assetHardMaxRawKb']
      ),
    },
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
}): boolean {
  if (!args.over) {
    console.log(`[${args.tag}] OK: ${args.message}`);
    return false;
  }
  const line = `[${args.tag}] ${args.mode === 'warn' ? 'WARN' : 'OVER'}: ${args.message}`;
  if (args.mode === 'warn') {
    console.warn(line);
    if (process.env['GITHUB_ACTIONS'] === 'true') {
      console.warn(`::warning::${args.message}`);
    }
    return false;
  }
  console.error(line);
  return true;
}
