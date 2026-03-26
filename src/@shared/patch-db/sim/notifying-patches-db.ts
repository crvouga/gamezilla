import type { PubSub } from '../../pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

const PATCHES_DB_TOPIC = 'patches-db';

/**
 * Wraps a {@link PatchesDb} and publishes on `patches-db` after successful writes
 * so simulated transports can mirror "server pushed invalidation" without `PatchDbImplSyncHost`.
 */
export class NotifyingPatchesDb implements PatchesDb {
  constructor(
    private readonly inner: PatchesDb,
    private readonly pubSub: PubSub
  ) {}

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.inner.read(queries);
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const out = await this.inner.write(patches);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return out;
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    return this.inner.update(updates);
  }
}
