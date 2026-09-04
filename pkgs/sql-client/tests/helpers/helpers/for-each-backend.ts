/**
 * Open each factory, run `fn`, cleanup sample tables, close ephemeral engines.
 * PGlite stays process-shared (close is a no-op).
 */

import {
  type BackendFactory,
  type MatrixBackend,
  openBackend,
} from '../backends';
import type { LogicalSchema } from '../generators/schema';
import { withBackendSample } from './run-program';

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
