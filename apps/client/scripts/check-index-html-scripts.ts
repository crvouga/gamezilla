#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Ban third-party <script src> in apps/client/index.html unless allowlisted
 * in perf-budget.json thirdParty.indexHtmlScriptAllowlist.
 *
 * usage: check-index-html-scripts.ts --budget=<perf-budget.json> [--html=<path>]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadPerfBudget, parseBudgetPath } from './perf-budget';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const DEFAULT_HTML = join(REPO_ROOT, 'apps/client/index.html');

function argValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

export function collectExternalScriptSrcs(html: string): string[] {
  const out: string[] = [];
  const re = /<script\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? '';
    if (/\btype\s*=\s*['"]module['"]/i.test(attrs)) {
      // App entry module is allowed (Vite).
      continue;
    }
    const src = /\bsrc\s*=\s*['"]([^'"]+)['"]/i.exec(attrs)?.[1];
    if (src === undefined) continue;
    out.push(src);
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const budgetRel = parseBudgetPath(argv);
  const budgetAbs = budgetRel.startsWith('/')
    ? budgetRel
    : join(process.cwd(), budgetRel);
  const budget = loadPerfBudget(budgetAbs);
  const htmlPath = argValue(argv, '--html') ?? DEFAULT_HTML;
  const html = readFileSync(htmlPath, 'utf8');
  const srcs = collectExternalScriptSrcs(html);
  const allow = new Set(budget.thirdParty.indexHtmlScriptAllowlist);
  const banned = srcs.filter((s) => !allow.has(s));

  if (banned.length === 0) {
    console.log(
      `[index-html-scripts] OK (${String(srcs.length)} external script(s), all allowlisted)`
    );
    return;
  }
  console.error(
    `[index-html-scripts] OVER: ${String(banned.length)} third-party script(s) in index.html without thirdParty.indexHtmlScriptAllowlist entry:`
  );
  for (const s of banned) {
    console.error(`  ${s}`);
  }
  process.exit(1);
}

if (import.meta.main) main();
