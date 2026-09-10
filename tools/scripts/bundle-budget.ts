#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Fail if the initial / lazy route assets exceed the low-end Android perf budget.
 * usage: bundle-budget.ts <dist-dir> --budget=<perf-budget.json>
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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
  pathMatchesDeferred,
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

export function brotliBytes(abs: string): number {
  return brotliCompressSync(readFileSync(abs), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
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

export function sumPrecacheFromSw(swJs: string): number {
  const m = /precacheAndRoute\(\s*(\[[\s\S]*?\])\s*(?:,|\))/m.exec(swJs);
  if (m?.[1] === undefined) return 0;
  try {
    const entries = JSON.parse(m[1]) as { size?: number }[];
    return entries.reduce((acc, e) => acc + (e.size ?? 0), 0);
  } catch {
    return 0;
  }
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

function walkDistFiles(distDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      out.push(relative(distDir, abs).split('\\').join('/'));
    }
  };
  walk(distDir);
  return out;
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
      const br = sumSizes(distDir, files, brotliBytes);
      console.log(
        `[bundle-budget] lazy "${root}" brotli ${kb(br.total).toFixed(1)} KB (report only)`
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

function checkSwPrecache(distDir: string, budget: PerfBudget): void {
  const swPath = join(distDir, 'sw.js');
  if (!existsSync(swPath)) {
    console.log('[bundle-budget] service worker precache — skipped (no sw.js)');
    return;
  }
  const total = sumPrecacheFromSw(readFileSync(swPath, 'utf8'));
  const totalKb = kb(total);
  const over = totalKb > budget.serviceWorker.precacheWarnKb;
  console.log(
    `[bundle-budget] SW precache ${totalKb.toFixed(1)} KB / ${String(budget.serviceWorker.precacheWarnKb)} KB warn — ${over ? 'WARN' : 'OK'}`
  );
  if (over) {
    console.warn(
      `[bundle-budget] WARN: SW precache ${totalKb.toFixed(1)} KB > serviceWorker.precacheWarnKb ${String(budget.serviceWorker.precacheWarnKb)} (offline first-install cost; not a hard fail)`
    );
  }
}

function checkPwaSplash(distDir: string, budget: PerfBudget): void {
  const splashFiles = walkDistFiles(distDir).filter((f) =>
    /pwa\/.*splash/i.test(f)
  );
  let total = 0;
  for (const f of splashFiles) {
    const abs = join(distDir, f);
    if (existsSync(abs)) total += rawBytes(abs);
  }
  const totalMb = total / (1024 * 1024);
  const over = totalMb > budget.pwaChrome.splashTotalWarnMb;
  console.log(
    `[bundle-budget] PWA splash chrome ${totalMb.toFixed(1)} MB / ${String(budget.pwaChrome.splashTotalWarnMb)} MB warn — ${over ? 'WARN' : 'OK'}`
  );
  if (over) {
    console.warn(
      `[bundle-budget] WARN: PWA splash total ${totalMb.toFixed(1)} MB > pwaChrome.splashTotalWarnMb`
    );
  }
}

function main(): void {
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
  const budget = loadPerfBudget(budgetAbs);

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

  const deferredHits = assertNoDeferredOnInitial({
    files: [...jsFiles, ...cssFiles, ...fontFiles],
    patterns: budget.deferredPathMustNotMatch,
  });

  const htmlPath = join(distDir, 'index.html');
  let htmlHits: string[] = [];
  let htmlGzip = 0;
  let html = '';
  if (existsSync(htmlPath)) {
    html = readFileSync(htmlPath, 'utf8');
    htmlGzip = gzipSync(Buffer.from(html), { level: 9 }).byteLength;
    htmlHits = findEntryHtmlPreloadHits({
      html,
      patterns: budget.deferredPathMustNotMatch,
    });
  }

  void walkDistFiles(distDir).filter((f) =>
    pathMatchesDeferred(f, budget.deferredPathMustNotMatch)
  );

  let failed = false;
  if (deferredHits.length > 0 || htmlHits.length > 0) {
    failed = true;
    console.error(
      '[bundle-budget] deferred assets referenced on the initial critical path:'
    );
    for (const hit of [...deferredHits, ...htmlHits]) {
      console.error(`  ${hit}`);
    }
  }

  const measurePrimary =
    budget.compression.primary === 'brotli' ? brotliBytes : gzipBytes;
  const jsPrimary = sumSizes(distDir, jsFiles, measurePrimary);
  const jsRaw = sumSizes(distDir, jsFiles, rawBytes);
  const cssPrimary = sumSizes(distDir, cssFiles, measurePrimary);
  const fonts = sumSizes(distDir, fontFiles, rawBytes);
  const imageFiles = [
    ...collectImageFilesFromCss({ distDir, cssRelPaths: cssFiles }),
    ...collectInitialHtmlImages(html),
  ];
  const images = sumSizes(distDir, [...new Set(imageFiles)], rawBytes);

  const primaryLabel = budget.compression.primary;
  failed =
    printRows(
      `initial JS ${primaryLabel}`,
      kb(jsPrimary.total),
      budget.initial.jsGzipKb,
      jsPrimary.rows
    ) || failed;
  failed =
    printRows(
      'initial JS raw',
      kb(jsRaw.total),
      budget.initial.jsRawKb,
      jsRaw.rows
    ) || failed;
  failed =
    printRows(
      `initial CSS ${primaryLabel}`,
      kb(cssPrimary.total),
      budget.initial.cssGzipKb,
      cssPrimary.rows
    ) || failed;
  failed =
    printRows('fonts', kb(fonts.total), budget.initial.fontsKb, fonts.rows) ||
    failed;
  failed =
    printRows(
      'initial images raw',
      kb(images.total),
      budget.initial.imagesRawKb,
      images.rows
    ) || failed;

  for (const row of images.rows) {
    if (row.kb > budget.initial.perImageRawKb) {
      failed = true;
      console.error(
        `[bundle-budget] OVER: image ${row.file} ${row.kb.toFixed(1)} KB > initial.perImageRawKb ${String(budget.initial.perImageRawKb)}`
      );
    }
  }

  if (budget.compression.alsoReport.includes('brotli')) {
    const jsBr = sumSizes(distDir, jsFiles, brotliBytes);
    const cssBr = sumSizes(distDir, cssFiles, brotliBytes);
    console.log(
      `[bundle-budget] initial JS brotli ${kb(jsBr.total).toFixed(1)} KB (report only)`
    );
    console.log(
      `[bundle-budget] initial CSS brotli ${kb(cssBr.total).toFixed(1)} KB (report only)`
    );
  }

  const criticalTotal =
    htmlGzip + jsPrimary.total + cssPrimary.total + fonts.total;
  const criticalKb = kb(criticalTotal);
  const criticalOver = criticalKb > budget.initial.criticalPathTotalGzipKb;
  console.log(
    `[bundle-budget] critical path total ${primaryLabel} ${criticalKb.toFixed(1)} KB / ${String(budget.initial.criticalPathTotalGzipKb)} KB — ${criticalOver ? 'OVER BUDGET' : 'OK'} (html + js + css + fonts)`
  );
  if (criticalOver) failed = true;

  failed = checkLazy(distDir, manifest, budget) || failed;
  failed = checkFontsDisplay(distDir, cssFiles, budget) || failed;
  checkSwPrecache(distDir, budget);
  checkPwaSplash(distDir, budget);

  if (failed) process.exit(1);
}

if (import.meta.main) main();
