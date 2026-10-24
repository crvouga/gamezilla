// @io-wall-ok — creates the verifier's private, source-equivalent input.
import { join } from 'node:path';
import { newIdGenerator, parsePhase1fromText } from '@informalsystems/quint';
import { cacheValueParameters } from './cache-value-parameters';
import { copyModelInput } from './copy-model-input';

/** Cache repeated value arguments without changing any model obligation. */
export function cachedVerifyInput(specPath: string, outDir: string): string {
  return copyModelInput(
    specPath,
    join(outDir, 'cached-source'),
    (source, path) => {
      const parsed = parsePhase1fromText(newIdGenerator(), source, path);
      return parsed.errors.length === 0 ? cacheValueParameters(source) : source;
    }
  );
}
