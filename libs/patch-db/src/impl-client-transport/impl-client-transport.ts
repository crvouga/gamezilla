import { assert } from '@gamezilla/lib/assert';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import type { PatchDbClientTransport } from '../transport/interface';

/**
 * PatchesDb adapter over {@link PatchDbClientTransport} (remote / transport boundary).
 */
export class PatchDbImplClientTransport implements PatchesDb {
  constructor(private transport: PatchDbClientTransport) {}

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.transport.read(queries);
  }

  write(patches: PatchInput[]): Promise<Patch[]> {
    return this.transport.write(patches);
  }

  async update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    assert.fail(
      'attribute updates are local-only for sync; remote does not need'
    );
  }
}
