#!/usr/bin/env bun
// goal:the-bar:7 — verify public endpoints are reachable.

const ENDPOINTS = [
  { url: 'https://www.gamezilla.app/', expectOk: true },
  { url: 'https://www.gamezilla.app/simulator', expectOk: true },
  { url: 'https://api.gamezilla.app/api/health', expectOk: false },
] as const;

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

async function checkEndpoint(
  url: string,
  expectRedirectOk: boolean
): Promise<{ status: number; ok: boolean }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: expectRedirectOk ? 'follow' : 'manual',
      });
      const ok = expectRedirectOk
        ? res.status >= 200 && res.status < 400
        : res.status >= 200 && res.status < 300;
      if (ok) return { status: res.status, ok: true };
      if (attempt < MAX_RETRIES) {
        console.log(
          `  [retry ${attempt + 1}] ${url} → ${res.status}, retrying…`
        );
        continue;
      }
      return { status: res.status, ok: false };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [retry ${attempt + 1}] ${url} → ${msg}, retrying…`);
        continue;
      }
      return { status: 0, ok: false };
    }
  }
  return { status: 0, ok: false };
}

let exitCode = 0;

console.log('Checking public endpoints…');
for (const { url, expectOk } of ENDPOINTS) {
  const { status, ok } = await checkEndpoint(url, expectOk);
  const label = ok ? 'OK' : 'FAIL';
  if (!ok) exitCode = 1;
  console.log(`  ${label} ${status} ${url}`);
}

if (exitCode !== 0) {
  console.error('Some public endpoints are unreachable or returned errors.');
}
process.exit(exitCode);
