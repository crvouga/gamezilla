import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { isLocalApiOrigin } from '@libs/auth/public/local-api-origin';
import { assert } from '@pkgs/assert';
import { readUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

/** Production API origin — must match `productionApiOrigin()` in `@libs/secrets`. */
export function productionClientApiOrigin(): string {
  return `https://${APP_IDENTITY.apiHost}`;
}

/** Marker the bundler leaves in the `getServerBaseUrl()` chunk when env is inlined. */
export const INLINED_API_URL_SENTINEL = 'VITE_API_URL is required';

/**
 * Minified production bundles assign the inlined env read to a `const` immediately
 * before the `assert.nonEmptyString` guard in `getServerBaseUrl()`.
 */
export const INLINED_API_URL_RE =
  /const (\w+)="(https?:\/\/[^"]+)";\w+\.assert\.nonEmptyString\(\1,'VITE_API_URL is required/;

export function extractInlinedApiUrlFromBundleSource(
  source: string
): string | null {
  const match = source.match(INLINED_API_URL_RE);
  if (match?.[2] !== undefined) return match[2];
  return null;
}

export function assertProductionClientBuildEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const raw = env['VITE_API_URL'];
  assert.nonEmptyString(
    raw,
    'VITE_API_URL is required for a production client build'
  );
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'VITE_API_URL must be a valid absolute URL',
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
    'Production client build VITE_API_URL must match the deployed API origin',
    { expected, got: origin, raw }
  );
}

async function listBundleFiles(store: ObjectStore): Promise<readonly string[]> {
  const keys = await store.listKeys();
  return keys.filter((key) => key.endsWith('.js'));
}

/**
 * Scans a production client bundle tree (ObjectStore) for baked-in API URL and
 * jsx-source markers. Construct at the call site — do not export free functions
 * that take {@link ObjectStore}.
 */
export class ProductionBundleGuard {
  constructor(private readonly store: ObjectStore) {}

  async assert(label: string): Promise<void> {
    const files = await listBundleFiles(this.store);
    assert.ok(files.length > 0, `${label}: no JS/HBC bundles found`);

    let scannedChunks = 0;
    for (const file of files) {
      const source = await readUtf8(this.store, file);
      assert.defined(source, `${label}: bundle disappeared during scan`, {
        file,
      });
      // Dev/E2E `data-src` path markers must not ship in production bundles.
      assert.ok(
        !source.includes('data-src') && !/"src":"[^"]+\.tsx?:\d+"/.test(source),
        `${label}: production bundle still contains data-src markers`,
        { file }
      );
      if (!source.includes(INLINED_API_URL_SENTINEL)) continue;
      scannedChunks += 1;
      const inlined = extractInlinedApiUrlFromBundleSource(source);
      assert.ok(
        inlined !== null,
        `${label}: could not parse inlined VITE_API_URL`,
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
        `${label}: bundle inlined VITE_API_URL does not match production origin`,
        { file, inlined, expected: productionClientApiOrigin() }
      );
    }

    assert.ok(
      scannedChunks > 0,
      `${label}: no getServerBaseUrl() bundle chunk found — cannot verify API URL was inlined`,
      { fileCount: files.length }
    );
  }
}
