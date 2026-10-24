// @io-wall-ok — private verifier inputs preserve the source's import graph.
import { join, resolve } from 'node:path';
import type { ModelParameters } from '@pkgs/quint-shared-ts/registry';
import { copyModelInput } from './copy-model-input';
import { instantiateModel } from './model-parameters';
import { quintModuleName } from './model-source';

/** Preserve imports while closing only the selected main module's constants. */
export function instantiatedModelInput(
  specPath: string,
  outDir: string,
  parameters: ModelParameters
): string {
  const main = resolve(specPath);
  return copyModelInput(
    main,
    join(outDir, 'instantiated-source'),
    (source, path) =>
      path === main
        ? instantiateModel(source, quintModuleName(main), parameters)
        : source
  );
}
