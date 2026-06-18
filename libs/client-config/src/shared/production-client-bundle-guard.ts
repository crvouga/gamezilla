import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import { isLocalApiOrigin } from '@libs/auth/shared/local-api-origin';
import { assert } from '@pkgs/assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Production Worker origin — must match `productionOrigin()` in `@libs/infra`. */
export function productionClientApiOrigin(): string {
  return `https://www.${APP_IDENTITY.domain}`;
}

/** Marker Metro leaves in the `getApiBaseUrl()` chunk when env is inlined. */
export const INLINED_API_URL_SENTINEL = 'EXPO_PUBLIC_API_URL is required';

/**
 * Minified production bundles assign the inlined env read to a `const` immediately
 * before the `assert.nonEmptyString` guard in `getApiBaseUrl()`.
 */
export const INLINED_API_URL_RE =
  /const (\w+)="(https?:\/\/[^"]+)";\w+\.assert\.nonEmptyString\(\1,'EXPO_PUBLIC_API_URL is required/;

export function extractInlinedApiUrlFromBundleSource(
  source: string
): string | null {
  const match = source.match(INLINED_API_URL_RE);
  return match?.[2] ?? null;
}

export function assertProductionClientBuildEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const raw = env['EXPO_PUBLIC_API_URL'];
  assert.nonEmptyString(
    raw,
    'EXPO_PUBLIC_API_URL is required for a production client build'
  );
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'EXPO_PUBLIC_API_URL must be a valid absolute URL',
    { raw }
  );
  assert.ok(
    !isLocalApiOrigin(origin),
    'Production client build must not target a loopback API origin',
    { origin, raw }
  );
  const expected = productionClientApiOrigin();
  assert.equals(
    origin,
    expected,
    'Production client build EXPO_PUBLIC_API_URL must match the deployed Worker origin',
    { expected, got: origin, raw }
  );
}

function listBundleFilesUnder(root: string): string[] {
  const paths: string[] = [];
  for (const rel of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (rel.endsWith('.js') || rel.endsWith('.hbc')) {
      paths.push(join(root, rel));
    }
  }
  return paths;
}

export function assertProductionBundlesAtDir(
  dir: string,
  label: string
): void {
  const files = listBundleFilesUnder(dir);
  assert.ok(
    files.length > 0,
    `${label}: no JS/HBC bundles found`,
    { dir }
  );

  let scannedChunks = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes(INLINED_API_URL_SENTINEL)) continue;
    scannedChunks += 1;
    const inlined = extractInlinedApiUrlFromBundleSource(source);
    assert.ok(
      inlined !== null,
      `${label}: could not parse inlined EXPO_PUBLIC_API_URL`,
      { file }
    );
    assert.ok(
      !isLocalApiOrigin(inlined),
      `${label}: bundle bakes a loopback API origin (refusing to ship)`,
      { file, inlined, expected: productionClientApiOrigin() }
    );
    assert.equals(
      inlined,
      productionClientApiOrigin(),
      `${label}: bundle inlined EXPO_PUBLIC_API_URL does not match production origin`,
      { file, inlined, expected: productionClientApiOrigin() }
    );
  }

  assert.ok(
    scannedChunks > 0,
    `${label}: no getApiBaseUrl() bundle chunk found — cannot verify API URL was inlined`,
    { dir, fileCount: files.length }
  );
}
