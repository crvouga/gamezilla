// @io-wall-ok — composition entry for the Gherkin harness's parameter catalog.
import type { ParameterTypeSpec } from '@pkgs/gherkin-shared-ts/registry';

/** Each domain owns one flat source entry; vocabulary is discovered, never appended here. */
const modules = [
  ...new Bun.Glob('parameter-types*.ts').scanSync(import.meta.dir),
].sort();
export const SPEC_PARAMETER_TYPES: readonly ParameterTypeSpec[] = (
  await Promise.all(
    modules.map(async (file) => {
      const entry = (await import(`./${file}`)) as {
        readonly PARAMETER_TYPES: readonly ParameterTypeSpec[];
      };
      return entry.PARAMETER_TYPES;
    })
  )
).flat();
