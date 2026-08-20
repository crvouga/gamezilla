/**
 * Playground snapshots are in-memory. Durable S3 is a contract/fidelity-max
 * concern — not part of `bun dev`.
 */

import type { Timers } from '@pkgs/clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';

export function createPlaygroundSnapshotStore(_timers: Timers): ObjectStore {
  return new ObjectStoreImplInMemory().withPrefix(
    ObjectStorePrefix.playgroundSnapshots
  );
}
