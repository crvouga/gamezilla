#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Shared loader + types for apps/client/perf-budget.json (schema v2).
 */
import { readFileSync } from 'node:fs';

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
  readonly thirdParty: {
    readonly indexHtmlScriptAllowlist: readonly string[];
  };
  readonly fonts: {
    readonly allowedFontDisplay: readonly string[];
  };
};

function requirePositive(path: string, n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(`bad budget.${path}`);
  }
  return n;
}

type RawSection = Record<string, unknown>;

type RawSections = {
  readonly compression: RawSection;
  readonly initial: RawSection;
  readonly lazy: RawSection;
  readonly thirdParty: RawSection;
  readonly fonts: RawSection;
};

const CORE_SECTIONS = ['compression', 'initial', 'lazy'] as const;

const POLICY_SECTIONS = ['thirdParty', 'fonts'] as const;

function isSection(value: unknown): value is RawSection {
  return value !== null && typeof value === 'object';
}

function requireSections(raw: Record<string, unknown>): RawSections {
  for (const key of CORE_SECTIONS) {
    if (!isSection(raw[key])) {
      throw new Error('bad budget: missing compression|initial|lazy');
    }
  }
  for (const key of POLICY_SECTIONS) {
    if (!isSection(raw[key])) {
      throw new Error('bad budget: missing thirdParty|fonts');
    }
  }
  return {
    compression: raw['compression'] as RawSection,
    initial: raw['initial'] as RawSection,
    lazy: raw['lazy'] as RawSection,
    thirdParty: raw['thirdParty'] as RawSection,
    fonts: raw['fonts'] as RawSection,
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

function thirdPartySection(raw: RawSection): PerfBudget['thirdParty'] {
  const allowlist = raw['indexHtmlScriptAllowlist'];
  return {
    indexHtmlScriptAllowlist: Array.isArray(allowlist)
      ? (allowlist as string[])
      : [],
  };
}

function fontsSection(raw: RawSection): PerfBudget['fonts'] {
  const display = raw['allowedFontDisplay'];
  return {
    allowedFontDisplay: Array.isArray(display)
      ? (display as string[])
      : ['swap', 'optional'],
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
    thirdParty: thirdPartySection(sections.thirdParty),
    fonts: fontsSection(sections.fonts),
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
