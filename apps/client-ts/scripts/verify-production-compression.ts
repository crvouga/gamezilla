#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Verify production edge serves Content-Encoding: br or gzip.
 * Warn-only by default; skip when offline.
 *
 * usage: verify-production-compression.ts [--origin=<web origin>]
 * (default: the production web origin, `https://www.<domain>`)
 */
import { webOrigin } from '@libs/product-identity-shared-ts/brand-hosts';

const DEFAULT_ORIGIN = webOrigin();

function argValue(argv: readonly string[], name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function verifyUrl(
  url: string
): Promise<{ ok: boolean; encoding: string }> {
  const res = await fetch(url, {
    method: 'HEAD',
    headers: { 'Accept-Encoding': 'br,gzip' },
    redirect: 'follow',
  });
  const encoding = (res.headers.get('content-encoding') ?? '').toLowerCase();
  const ok = encoding.includes('br') || encoding.includes('gzip');
  return { ok, encoding: encoding || '(none)' };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const origin = argValue(argv, '--origin') ?? DEFAULT_ORIGIN;
  const urls = [`${origin}/`, `${origin}/favicon.ico`];

  try {
    let failed = false;
    for (const url of urls) {
      const { ok, encoding } = await verifyUrl(url);
      const line = `[prod-compression] ${url} Content-Encoding=${encoding}`;
      if (ok) {
        console.log(`${line} — OK`);
      } else {
        failed = true;
        console.warn(`${line} — WARN (expected br or gzip)`);
        // Reporting only (exempt from no-ci-verdict.grit): an annotation, and
        // the script exits 0 on every path.
        if (process.env['GITHUB_ACTIONS'] === 'true') {
          console.warn(`::warning::${line}`);
        }
      }
    }
    // Always exit 0 in warn-only mode.
    void failed;
    process.exit(0);
  } catch (err) {
    console.warn(
      `[prod-compression] WARN: skipped (unreachable): ${String(err)}`
    );
    process.exit(0);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
