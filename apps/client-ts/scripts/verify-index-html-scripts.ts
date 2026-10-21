// @io-wall-ok — static analysis over the source tree (scripts/**).
/**
 * Ban third-party <script src> in apps/client-ts/index.html unless allowlisted
 * in `INDEX_HTML_SCRIPT_ALLOWLIST`. Asserted by this package's tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT_DIR = join(import.meta.dirname, '..');

/** Third-party `<script src>` URLs index.html may load. None today. */
const INDEX_HTML_SCRIPT_ALLOWLIST: readonly string[] = [];

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
 * `INDEX_HTML_SCRIPT_ALLOWLIST` does not allow.
 */
export function bannedIndexHtmlScripts(): string[] {
  const html = readFileSync(join(CLIENT_DIR, 'index.html'), 'utf8');
  const allow = new Set(INDEX_HTML_SCRIPT_ALLOWLIST);
  return collectExternalScriptSrcs(html).filter((src) => !allow.has(src));
}
