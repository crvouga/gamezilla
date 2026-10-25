// @io-wall-ok — composition entry loads the harness's specification modules.
import type { ConformanceNeed } from './game-conformance';

/** One specification per entry keeps independent additions out of a shared register. */
export async function loadSpecificationNeeds(): Promise<
  Readonly<Record<string, readonly ConformanceNeed[]>>
> {
  const files = [
    ...new Bun.Glob('*.json').scanSync(`${import.meta.dir}/../specifications`),
  ].sort();
  const entries = await Promise.all(
    files.map(async (file) => {
      const entry = (await import(`../specifications/${file}`, {
        with: { type: 'json' },
      })) as {
        readonly default: readonly ConformanceNeed[];
      };
      return [file.slice(0, -'.json'.length), entry.default] as const;
    })
  );
  return Object.fromEntries(entries);
}
