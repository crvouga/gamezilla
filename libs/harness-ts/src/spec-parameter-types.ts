// @io-wall-ok — composition entry for the Gherkin harness's parameter catalog.
import type { ParameterTypeSpec } from '@pkgs/gherkin-shared-ts/registry';

type Entry = { readonly PARAMETER_TYPES: readonly ParameterTypeSpec[] };

const PATTERN = 'parameter-types*.ts';

/** Vite's build-time glob, typed here because this package has no Vite types. */
type BundlerMeta = {
  glob<T>(pattern: string, options: { eager: true }): Record<string, T>;
};

/**
 * Each domain owns one flat source entry; vocabulary is discovered, never
 * appended here. Bun scans the directory; the browser bundle has no
 * directory, so Vite resolves the same pattern when it builds the harness.
 */
async function discover(): Promise<readonly Entry[]> {
  if (typeof Bun === 'undefined') {
    const found = (import.meta as unknown as BundlerMeta).glob<Entry>(
      './parameter-types*.ts',
      {
        eager: true,
      }
    );
    return Object.keys(found)
      .sort()
      .flatMap((file) => found[file] ?? []);
  }
  const files = [...new Bun.Glob(PATTERN).scanSync(import.meta.dir)].sort();
  return Promise.all(
    files.map(async (file) => (await import(`./${file}`)) as Entry)
  );
}

export const SPEC_PARAMETER_TYPES: readonly ParameterTypeSpec[] = (
  await discover()
).flatMap((entry) => entry.PARAMETER_TYPES);
