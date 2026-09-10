#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Sum first-load API response bodies observed by the perf API stub
 * (or a real origin) during a Playwright/Chrome cold load.
 *
 * For the stub harness, instruments the stub itself via a shared counter file.
 *
 * usage: check-first-load-api-budget.ts --budget=<perf-budget.json> [--bytes=<n>]
 */
import { join } from 'node:path';

import { kb, loadPerfBudget, parseBudgetPath, reportGate } from './perf-budget';

function argValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

export function assertFirstLoadApiBytes(args: {
  readonly totalBytes: number;
  readonly budgetKb: number;
  readonly mode: 'warn' | 'error';
}): boolean {
  const totalKb = kb(args.totalBytes);
  return reportGate({
    tag: 'first-load-api',
    mode: args.mode,
    over: totalKb > args.budgetKb,
    message: `boot API transfer ${totalKb.toFixed(1)} KB > firstLoadApi.totalGzipKb ${String(args.budgetKb)}`,
  });
}

function main(): void {
  const argv = process.argv.slice(2);
  const budgetRel = parseBudgetPath(argv);
  const budgetAbs = budgetRel.startsWith('/')
    ? budgetRel
    : join(process.cwd(), budgetRel);
  const budget = loadPerfBudget(budgetAbs);
  const bytesRaw = argValue(argv, '--bytes');
  if (bytesRaw === undefined) {
    console.log(
      `[first-load-api] SKIP: pass --bytes=<n> from the LHCI/memory harness (budget ${String(budget.firstLoadApi.totalGzipKb)} KB)`
    );
    process.exit(0);
    return;
  }
  const totalBytes = Number(bytesRaw);
  if (!Number.isFinite(totalBytes) || totalBytes < 0) {
    console.error('[first-load-api] bad --bytes');
    process.exit(2);
  }
  const failed = assertFirstLoadApiBytes({
    totalBytes,
    budgetKb: budget.firstLoadApi.totalGzipKb,
    mode: budget.firstLoadApi.mode,
  });
  if (failed) process.exit(1);
}

if (import.meta.main) main();
