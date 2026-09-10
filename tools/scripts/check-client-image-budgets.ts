#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Static image weight gate for apps/client assets (non-PWA).
 * Fails if PNG/JPEG exceeds thresholds without a sibling webp/avif,
 * or if any image exceeds the hard max.
 *
 * usage: check-client-image-budgets.ts --budget=<perf-budget.json>
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { kb, loadPerfBudget, parseBudgetPath, reportGate } from './perf-budget';

const REPO_ROOT = join(import.meta.dirname, '../..');
const ROOTS = [
  join(REPO_ROOT, 'apps/client/src/assets'),
  join(REPO_ROOT, 'apps/client/public'),
];

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (name === 'pwa') continue; // PWA chrome tracked separately
        walk(abs);
        continue;
      }
      out.push(abs);
    }
  };
  walk(dir);
  return out;
}

function hasModernSibling(abs: string): boolean {
  const base = abs.replace(/\.(png|jpe?g)$/i, '');
  return existsSync(`${base}.webp`) || existsSync(`${base}.avif`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const budgetRel = parseBudgetPath(argv);
  const budgetAbs = budgetRel.startsWith('/')
    ? budgetRel
    : join(process.cwd(), budgetRel);
  const budget = loadPerfBudget(budgetAbs);

  let failed = false;
  for (const root of ROOTS) {
    for (const abs of walkFiles(root)) {
      if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(abs)) continue;
      const sizeKb = kb(statSync(abs).size);
      const rel = relative(REPO_ROOT, abs);
      if (sizeKb > budget.images.assetHardMaxRawKb) {
        failed =
          reportGate({
            tag: 'image-budget',
            mode: budget.images.mode,
            over: true,
            message: `${rel} ${sizeKb.toFixed(1)} KB > images.assetHardMaxRawKb ${String(budget.images.assetHardMaxRawKb)}`,
          }) || failed;
        continue;
      }
      if (
        /\.(png|jpe?g)$/i.test(abs) &&
        sizeKb > budget.images.assetPngJpegMaxRawKb &&
        !hasModernSibling(abs)
      ) {
        failed =
          reportGate({
            tag: 'image-budget',
            mode: budget.images.mode,
            over: true,
            message: `${rel} ${sizeKb.toFixed(1)} KB PNG/JPEG > images.assetPngJpegMaxRawKb ${String(budget.images.assetPngJpegMaxRawKb)} without sibling .webp/.avif`,
          }) || failed;
      }
    }
  }

  void readFileSync(budgetAbs, 'utf8');

  if (failed) process.exit(1);
  console.log('[image-budget] OK');
}

if (import.meta.main) main();
