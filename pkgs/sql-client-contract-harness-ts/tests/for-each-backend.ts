/**
 * Open each factory, run `fn`, cleanup sample tables, close ephemeral engines.
 */

import { openBackend } from './registry';
import { withBackendSample } from './run-program';
import type { LogicalSchema } from './schema';
import type { BackendFactory, MatrixBackend } from './types';

export async function forEachBackendSample(
  factories: readonly BackendFactory[],
  schema: LogicalSchema,
  fn: (backend: MatrixBackend) => Promise<void>
): Promise<void> {
  for (const factory of factories) {
    const backend = await openBackend(factory);
    try {
      await withBackendSample(backend, schema, async () => {
        await fn(backend);
      });
    } finally {
      await backend.close();
    }
  }
}
