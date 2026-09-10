#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Headless Chrome heap probe for shell + navigation (warn-only by default).
 * Uses puppeteer-core via bunx when Chrome is available; otherwise skips.
 *
 * usage: client-memory-probe.ts --budget=<perf-budget.json> [--origin=http://127.0.0.1:5177]
 */
import { join } from 'node:path';

import { loadPerfBudget, parseBudgetPath, reportGate } from './perf-budget';

function argValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

type HeapSample = { readonly jsHeapUsedMb: number };

async function sampleWithPuppeteer(
  origin: string
): Promise<{ shell: HeapSample; afterNav: HeapSample } | null> {
  try {
    const puppeteer = (await import('puppeteer-core')) as {
      default: {
        launch: (opts: Record<string, unknown>) => Promise<{
          newPage: () => Promise<{
            goto: (
              url: string,
              opts: Record<string, unknown>
            ) => Promise<unknown>;
            evaluate: (fn: () => number) => Promise<number>;
            close: () => Promise<void>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    };
    const executablePath =
      process.env['CHROME_PATH'] ??
      process.env['PUPPETEER_EXECUTABLE_PATH'] ??
      '/usr/bin/google-chrome';
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.goto(`${origin}/`, {
        waitUntil: 'networkidle2',
        timeout: 60_000,
      });
      const heap = async (): Promise<number> =>
        page.evaluate(() => {
          const perf = performance as Performance & {
            memory?: { usedJSHeapSize?: number };
          };
          return (perf.memory?.usedJSHeapSize ?? 0) / (1024 * 1024);
        });
      const shell = { jsHeapUsedMb: await heap() };
      await page.goto(`${origin}/more`, {
        waitUntil: 'networkidle2',
        timeout: 60_000,
      });
      await page.goto(`${origin}/profile`, {
        waitUntil: 'networkidle2',
        timeout: 60_000,
      });
      const afterNav = { jsHeapUsedMb: await heap() };
      await page.close();
      return { shell, afterNav };
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.warn(
      `[memory-probe] WARN: skipped (Chrome/puppeteer unavailable): ${String(err)}`
    );
    return null;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const budgetRel = parseBudgetPath(argv);
  const budgetAbs = budgetRel.startsWith('/')
    ? budgetRel
    : join(process.cwd(), budgetRel);
  const budget = loadPerfBudget(budgetAbs);
  const origin = argValue(argv, '--origin') ?? 'http://127.0.0.1:5177';

  const samples = await sampleWithPuppeteer(origin);
  if (samples === null) {
    process.exit(0);
    return;
  }

  let failed = false;
  const shellOver = samples.shell.jsHeapUsedMb > budget.memory.shellJsHeapMb;
  if (
    reportGate({
      tag: 'memory-probe',
      mode: budget.memory.mode,
      over: shellOver,
      message: shellOver
        ? `shell JS heap ${samples.shell.jsHeapUsedMb.toFixed(1)} MB exceeds memory.shellJsHeapMb ${String(budget.memory.shellJsHeapMb)}`
        : `shell JS heap ${samples.shell.jsHeapUsedMb.toFixed(1)} MB within memory.shellJsHeapMb ${String(budget.memory.shellJsHeapMb)}`,
    }) === 'fail'
  ) {
    failed = true;
  }

  const navOver =
    samples.afterNav.jsHeapUsedMb > budget.memory.afterNavJsHeapMb;
  if (
    reportGate({
      tag: 'memory-probe',
      mode: budget.memory.mode,
      over: navOver,
      message: navOver
        ? `after /more+/profile JS heap ${samples.afterNav.jsHeapUsedMb.toFixed(1)} MB exceeds memory.afterNavJsHeapMb ${String(budget.memory.afterNavJsHeapMb)}`
        : `after /more+/profile JS heap ${samples.afterNav.jsHeapUsedMb.toFixed(1)} MB within memory.afterNavJsHeapMb ${String(budget.memory.afterNavJsHeapMb)}`,
    }) === 'fail'
  ) {
    failed = true;
  }

  if (failed) process.exit(1);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
