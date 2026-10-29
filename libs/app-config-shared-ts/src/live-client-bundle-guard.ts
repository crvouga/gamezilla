import { isLocalApiOrigin } from '@libs/auth-shared-ts/local-api-origin';
import { brandOrigin } from '@libs/product-identity-shared-ts/brand-hosts';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

/** Production API origin — the default expected origin for live-bundle checks. */
export function productionClientApiOrigin(): string {
  return brandOrigin('api');
}

/** Marker the bundler leaves in the `getServerBaseUrl()` chunk when env is inlined. */
export const INLINED_API_URL_SENTINEL = 'VITE_API_URL is required';

/**
 * Vite/rolldown inlines `import.meta.env` as an object literal; the API URL
 * lands as a backtick string on `VITE_API_URL` in that same chunk.
 */
export const INLINED_API_URL_RE = /VITE_API_URL:`(https?:\/\/[^`]+)`/;

export function extractInlinedApiUrlFromBundleSource(
  source: string
): string | null {
  const match = source.match(INLINED_API_URL_RE);
  if (match?.[1] !== undefined) return match[1];
  return null;
}

/**
 * `expected` is the API origin of the environment being built
 * (`https://<hosts.api>` from `libs/infra-shared-ts/tofu/envs/<env>.tfvars.json`);
 * it defaults to production's.
 */
export function assertLiveClientBuildEnv(
  env: NodeJS.ProcessEnv = process.env,
  expected: string = productionClientApiOrigin()
): void {
  const raw = env['VITE_API_URL'];
  assert.nonEmptyString(
    raw,
    'VITE_API_URL is required for a live client build'
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
    'Live client build must not target a loopback API origin',
    { origin, raw }
  );
  assert.equals(
    origin,
    expected,
    'Live client build VITE_API_URL must match the deployed API origin',
    { expected, got: origin, raw }
  );
}

async function listBundleFiles(store: ObjectStore): Promise<readonly string[]> {
  const keys = await store.listKeys();
  return keys.filter((key) => key.endsWith('.js'));
}

/**
 * Scans a live client bundle tree (ObjectStore) for baked-in API URL and
 * jsx-source markers. Construct at the call site — do not export free functions
 * that take {@link ObjectStore}. `expected` is the built environment's API
 * origin; it defaults to production's.
 */
export class LiveBundleGuard {
  constructor(
    private readonly store: ObjectStore,
    private readonly expected: string = productionClientApiOrigin()
  ) {}

  async assert(label: string): Promise<void> {
    const files = await listBundleFiles(this.store);
    assert.ok(files.length > 0, `${label}: no JS/HBC bundles found`);

    let scannedChunks = 0;
    for (const file of files) {
      const source = await readUtf8(this.store, file);
      assert.defined(source, `${label}: bundle disappeared during scan`, {
        file,
      });
      // Dev/spec `data-src` path markers must not ship in live bundles.
      assert.ok(
        !source.includes('data-src') && !/"src":"[^"]+\.tsx?:\d+"/.test(source),
        `${label}: live bundle still contains data-src markers`,
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
        { file, inlined, expected: this.expected }
      );
      assert.equals(
        inlined,
        this.expected,
        `${label}: bundle inlined VITE_API_URL does not match deployed API origin`,
        { file, inlined, expected: this.expected }
      );
    }

    assert.ok(
      scannedChunks > 0,
      `${label}: no getServerBaseUrl() bundle chunk found — cannot verify API URL was inlined`,
      { fileCount: files.length }
    );
  }
}
