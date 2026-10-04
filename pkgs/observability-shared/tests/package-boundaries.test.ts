import { describe, expect, test } from 'bun:test';

const PACKAGE_ROOT = new URL('../', import.meta.url);
const PUBLIC_ENTRYPOINTS = [
  './browser',
  './core',
  './node',
  './query',
  './worker',
] as const;

type PackageManifest = {
  readonly exports: Readonly<Record<string, string>>;
};

describe('observability package boundaries', () => {
  test('exports only the five supported entrypoints', async () => {
    const manifest = (await Bun.file(
      new URL('package.json', PACKAGE_ROOT)
    ).json()) as PackageManifest;

    expect(Object.keys(manifest.exports).toSorted()).toEqual(
      [...PUBLIC_ENTRYPOINTS].toSorted()
    );
    for (const target of Object.values(manifest.exports)) {
      expect(target).not.toContain('/runtime/');
      expect(target).toEndWith('/index.ts');
      expect(target).not.toContain('*');
    }
  });
});
