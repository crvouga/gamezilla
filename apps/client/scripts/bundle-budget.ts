#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Fail if the initial / lazy route assets exceed the low-end Android perf budget.
 * usage: bundle-budget.ts <dist-dir> --budget=<perf-budget.json>
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import {
  collectLazyRoots,
  lazyGraphJsFiles,
  lazyOverrideKey,
} from './bundle-budget-lazy';
import {
  assertNoDeferredOnInitial,
  collectInitialChunkKeys,
  collectInitialCssFiles,
  collectInitialJsFiles,
  findEntryHtmlPreloadHits,
  type Manifest,
} from './bundle-budget-manifest';
import {
  kb,
  loadPerfBudget,
  type PerfBudget,
  parseBudgetPath,
} from './perf-budget';

export {
  collectLazyRoots,
  lazyGraphJsFiles,
  lazyOverrideKey,
} from './bundle-budget-lazy';
export type { Manifest, ManifestChunk } from './bundle-budget-manifest';
export {
  assertNoDeferredOnInitial,
  collectInitialCssFiles,
  collectInitialJsFiles,
  findEntryHtmlPreloadHits,
  pathMatchesDeferred,
} from './bundle-budget-manifest';

export function gzipBytes(abs: string): number {
  return gzipSync(readFileSync(abs), { level: 9 }).byteLength;
}

/**
 * What a CDN would actually ship: brotli at maximum quality. Slow on purpose —
 * only use it for a number the budget enforces.
 */
export function brotliBytes(abs: string): number {
  return brotliCompressSync(readFileSync(abs), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength;
}

/**
 * Quality for the brotli figures the budget only *reports*.
 *
 * `perf-budget.json` enforces gzip and lists brotli under `alsoReport`, so
 * every brotli number in the log is informational — and computing them at
 * quality 11 cost 17.3s per pass over the client's 167 JS chunks, several
 * passes per run, for digits nobody gates on. Quality 5 is the same work in
 * 0.1s and lands ~13% high (1484 KB vs 1315 KB), which is fine for a trend
 * line and is labelled as an estimate. Make brotli the enforced metric and it
 * goes back through {@link brotliBytes} at full quality.
 */
const REPORT_BROTLI_QUALITY = 5;

export function brotliReportBytes(abs: string): number {
  return brotliCompressSync(readFileSync(abs), {
    params: { [constants.BROTLI_PARAM_QUALITY]: REPORT_BROTLI_QUALITY },
  }).byteLength;
}

export function rawBytes(abs: string): number {
  return readFileSync(abs).byteLength;
}

const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const URL_IN_CSS = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

export function collectFontFilesFromCss(args: {
  readonly distDir: string;
  readonly cssRelPaths: readonly string[];
}): string[] {
  return collectUrlAssetsFromCss({ ...args, ext: FONT_EXT });
}

export function collectImageFilesFromCss(args: {
  readonly distDir: string;
  readonly cssRelPaths: readonly string[];
}): string[] {
  return collectUrlAssetsFromCss({ ...args, ext: IMG_EXT });
}

function collectUrlAssetsFromCss(args: {
  readonly distDir: string;
  readonly cssRelPaths: readonly string[];
  readonly ext: RegExp;
}): string[] {
  const out = new Set<string>();
  for (const cssRel of args.cssRelPaths) {
    const abs = join(args.distDir, cssRel);
    if (!existsSync(abs)) continue;
    const css = readFileSync(abs, 'utf8');
    const cssDir = dirname(cssRel);
    URL_IN_CSS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_IN_CSS.exec(css)) !== null) {
      const raw = m[1];
      if (raw === undefined || raw.startsWith('data:')) continue;
      const cleaned = raw.split('?')[0]?.split('#')[0] ?? raw;
      if (!args.ext.test(cleaned)) continue;
      const rel = cleaned.startsWith('/')
        ? cleaned.slice(1)
        : join(cssDir, cleaned).split('\\').join('/');
      out.add(rel);
    }
  }
  return [...out];
}

/** Images linked from HTML without apple-touch-startup-image media queries. */
export function collectInitialHtmlImages(html: string): string[] {
  const out: string[] = [];
  const re =
    /<link\b(?![^>]*apple-touch-startup-image)[^>]*href\s*=\s*['"]([^'"]+\.(?:png|jpe?g|gif|webp|avif|svg))['"][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href === undefined) continue;
    out.push(href.startsWith('/') ? href.slice(1) : href);
  }
  return out;
}

function sumSizes(
  distDir: string,
  files: readonly string[],
  measure: (abs: string) => number
): { total: number; rows: { file: string; kb: number }[] } {
  let total = 0;
  const rows: { file: string; kb: number }[] = [];
  for (const file of files) {
    const abs = join(distDir, file);
    if (!existsSync(abs)) continue;
    const bytes = measure(abs);
    total += bytes;
    rows.push({ file, kb: kb(bytes) });
  }
  rows.sort((a, b) => b.kb - a.kb);
  return { total, rows };
}

function printRows(
  label: string,
  totalKb: number,
  budgetKb: number,
  rows: { file: string; kb: number }[]
): boolean {
  const over = totalKb > budgetKb;
  console.log(
    `[bundle-budget] ${label} ${totalKb.toFixed(1)} KB / ${String(budgetKb)} KB — ${over ? 'OVER BUDGET' : 'OK'}`
  );
  const show = over ? rows : rows.slice(0, 8);
  for (const row of show) {
    console.log(`  ${row.kb.toFixed(1).padStart(8)} KB  ${row.file}`);
  }
  return over;
}

function checkLazy(
  distDir: string,
  manifest: Manifest,
  budget: PerfBudget
): boolean {
  const initialKeys = new Set(collectInitialChunkKeys(manifest));
  let failed = false;
  for (const root of collectLazyRoots(manifest)) {
    const files = lazyGraphJsFiles(manifest, root, initialKeys);
    const gzip = sumSizes(distDir, files, gzipBytes);
    const override = lazyOverrideKey(root, budget.lazy.overrides);
    const limit =
      override !== undefined
        ? (budget.lazy.overrides[override] ?? budget.lazy.defaultGzipKb)
        : budget.lazy.defaultGzipKb;
    const totalKb = kb(gzip.total);
    const over = totalKb > limit;
    const via =
      override !== undefined
        ? `lazy.overrides["${override}"]=${String(limit)}`
        : `lazy.defaultGzipKb=${String(limit)}`;
    console.log(
      `[bundle-budget] lazy "${root}" ${totalKb.toFixed(1)} KB gzip / ${String(limit)} KB (${via}) — ${over ? 'OVER BUDGET' : 'OK'}`
    );
    if (over) {
      failed = true;
      console.error(
        `[bundle-budget] OVER: lazy "${root}" graph ${totalKb.toFixed(1)} KB gzip > ${via}. Add an override after review or split the chunk.`
      );
      for (const row of gzip.rows.slice(0, 12)) {
        console.error(`  ${row.kb.toFixed(1).padStart(8)} KB  ${row.file}`);
      }
    }
    if (budget.compression.alsoReport.includes('brotli')) {
      const br = sumSizes(distDir, files, brotliReportBytes);
      console.log(
        `[bundle-budget] lazy "${root}" brotli ~${kb(br.total).toFixed(1)} KB (report only, q5 estimate)`
      );
    }
  }
  return failed;
}

function checkFontsDisplay(
  distDir: string,
  cssFiles: readonly string[],
  budget: PerfBudget
): boolean {
  let failed = false;
  for (const cssRel of cssFiles) {
    const abs = join(distDir, cssRel);
    if (!existsSync(abs)) continue;
    const css = readFileSync(abs, 'utf8');
    if (!/@font-face\b/i.test(css)) continue;
    const allowed = budget.fonts.allowedFontDisplay.join('|');
    const displayOk = new RegExp(
      `font-display\\s*:\\s*(?:${allowed})`,
      'i'
    ).test(css);
    if (!displayOk) {
      failed = true;
      console.error(
        `[bundle-budget] OVER: @font-face in ${cssRel} missing font-display: ${budget.fonts.allowedFontDisplay.join('|')}`
      );
    }
  }
  return failed;
}

type SizeSummary = {
  readonly total: number;
  readonly rows: { file: string; kb: number }[];
};

type InitialBundle = {
  readonly distDir: string;
  readonly budget: PerfBudget;
  readonly manifest: Manifest;
  readonly jsFiles: readonly string[];
  readonly cssFiles: readonly string[];
  readonly fontFiles: readonly string[];
  readonly html: string;
  readonly htmlGzip: number;
};

type MeasuredInitial = {
  readonly primaryLabel: 'gzip' | 'brotli';
  readonly jsPrimary: SizeSummary;
  readonly jsRaw: SizeSummary;
  readonly cssPrimary: SizeSummary;
  readonly fonts: SizeSummary;
  readonly images: SizeSummary;
};

function resolveBundleInputs(): { distDir: string; budget: PerfBudget } {
  const [distDir, ...rest] = process.argv.slice(2);
  if (distDir === undefined) {
    console.error(
      'usage: bundle-budget.ts <dist-dir> --budget=<perf-budget.json>'
    );
    process.exit(2);
  }
  const budgetPath = parseBudgetPath(rest);
  const budgetAbs = budgetPath.startsWith('/')
    ? budgetPath
    : join(process.cwd(), budgetPath);
  return { distDir, budget: loadPerfBudget(budgetAbs) };
}

function collectInitialBundle(
  distDir: string,
  budget: PerfBudget
): InitialBundle {
  const manifestPath = join(distDir, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(
      `[bundle-budget] missing ${manifestPath}; run the build first`
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const jsFiles = collectInitialJsFiles(manifest);
  const cssFiles = collectInitialCssFiles(manifest);
  const fontFiles = collectFontFilesFromCss({
    distDir,
    cssRelPaths: cssFiles,
  });
  const htmlPath = join(distDir, 'index.html');
  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : '';
  const htmlGzip =
    html.length > 0 ? gzipSync(Buffer.from(html), { level: 9 }).byteLength : 0;
  return {
    distDir,
    budget,
    manifest,
    jsFiles,
    cssFiles,
    fontFiles,
    html,
    htmlGzip,
  };
}

function measureInitial(bundle: InitialBundle): MeasuredInitial {
  const { distDir, budget, html } = bundle;
  const primaryLabel = budget.compression.primary;
  const measurePrimary = primaryLabel === 'brotli' ? brotliBytes : gzipBytes;
  const imageFiles = [
    ...collectImageFilesFromCss({ distDir, cssRelPaths: bundle.cssFiles }),
    ...collectInitialHtmlImages(html),
  ];
  return {
    primaryLabel,
    jsPrimary: sumSizes(distDir, bundle.jsFiles, measurePrimary),
    jsRaw: sumSizes(distDir, bundle.jsFiles, rawBytes),
    cssPrimary: sumSizes(distDir, bundle.cssFiles, measurePrimary),
    fonts: sumSizes(distDir, bundle.fontFiles, rawBytes),
    images: sumSizes(distDir, [...new Set(imageFiles)], rawBytes),
  };
}

function checkDeferred(
  files: readonly string[],
  html: string,
  patterns: readonly string[]
): boolean {
  const deferredHits = assertNoDeferredOnInitial({ files, patterns });
  const htmlHits = findEntryHtmlPreloadHits({ html, patterns });
  if (deferredHits.length === 0 && htmlHits.length === 0) return false;
  console.error(
    '[bundle-budget] deferred assets referenced on the initial critical path:'
  );
  for (const hit of [...deferredHits, ...htmlHits]) {
    console.error(`  ${hit}`);
  }
  return true;
}

function reportInitialRows(
  bundle: InitialBundle,
  measured: MeasuredInitial
): boolean {
  const { budget, distDir, htmlGzip } = bundle;
  const { primaryLabel, jsPrimary, jsRaw, cssPrimary, fonts, images } =
    measured;
  let failed =
    printRows(
      `initial JS ${primaryLabel}`,
      kb(jsPrimary.total),
      budget.initial.jsGzipKb,
      jsPrimary.rows
    ) ||
    printRows(
      'initial JS raw',
      kb(jsRaw.total),
      budget.initial.jsRawKb,
      jsRaw.rows
    ) ||
    printRows(
      `initial CSS ${primaryLabel}`,
      kb(cssPrimary.total),
      budget.initial.cssGzipKb,
      cssPrimary.rows
    ) ||
    printRows('fonts', kb(fonts.total), budget.initial.fontsKb, fonts.rows) ||
    printRows(
      'initial images raw',
      kb(images.total),
      budget.initial.imagesRawKb,
      images.rows
    );

  for (const row of images.rows) {
    if (row.kb > budget.initial.perImageRawKb) {
      failed = true;
      console.error(
        `[bundle-budget] OVER: image ${row.file} ${row.kb.toFixed(1)} KB > initial.perImageRawKb ${String(budget.initial.perImageRawKb)}`
      );
    }
  }

  if (budget.compression.alsoReport.includes('brotli')) {
    const jsBr = sumSizes(distDir, bundle.jsFiles, brotliReportBytes);
    const cssBr = sumSizes(distDir, bundle.cssFiles, brotliReportBytes);
    console.log(
      `[bundle-budget] initial JS brotli ~${kb(jsBr.total).toFixed(1)} KB (report only, q5 estimate)`
    );
    console.log(
      `[bundle-budget] initial CSS brotli ~${kb(cssBr.total).toFixed(1)} KB (report only, q5 estimate)`
    );
  }

  const criticalTotal =
    htmlGzip + jsPrimary.total + cssPrimary.total + fonts.total;
  const criticalKb = kb(criticalTotal);
  const criticalOver = criticalKb > budget.initial.criticalPathTotalGzipKb;
  console.log(
    `[bundle-budget] critical path total ${primaryLabel} ${criticalKb.toFixed(1)} KB / ${String(budget.initial.criticalPathTotalGzipKb)} KB — ${criticalOver ? 'OVER BUDGET' : 'OK'} (html + js + css + fonts)`
  );
  return failed || criticalOver;
}

function main(): void {
  const { distDir, budget } = resolveBundleInputs();
  const bundle = collectInitialBundle(distDir, budget);
  const measured = measureInitial(bundle);

  let failed = checkDeferred(
    [...bundle.jsFiles, ...bundle.cssFiles, ...bundle.fontFiles],
    bundle.html,
    budget.deferredPathMustNotMatch
  );
  failed = reportInitialRows(bundle, measured) || failed;
  failed = checkLazy(distDir, bundle.manifest, budget) || failed;
  failed = checkFontsDisplay(distDir, bundle.cssFiles, budget) || failed;

  if (failed) process.exit(1);
}

if (import.meta.main) main();
