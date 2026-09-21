// @io-wall-ok — static analysis over the source tree (scripts/**).
/**
 * Ban third-party <script src> in apps/client/index.html unless allowlisted
 * in perf-budget.json thirdParty.indexHtmlScriptAllowlist. Asserted by this
 * package's tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadPerfBudget } from './perf-budget';

const CLIENT_DIR = join(import.meta.dirname, '..');

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

/**
 * Third-party `<script src>` in the shipped index.html that
 * perf-budget.json `thirdParty.indexHtmlScriptAllowlist` does not allow.
 */
export function bannedIndexHtmlScripts(): string[] {
  const budget = loadPerfBudget(join(CLIENT_DIR, 'perf-budget.json'));
  const html = readFileSync(join(CLIENT_DIR, 'index.html'), 'utf8');
  const allow = new Set(budget.thirdParty.indexHtmlScriptAllowlist);
  return collectExternalScriptSrcs(html).filter((src) => !allow.has(src));
}
