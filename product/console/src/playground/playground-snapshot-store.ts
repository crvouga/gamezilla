/**
 * Playground snapshots persist in the browser via hierarchical ClientFs
 * ObjectStore (OPFS on web / Expo document FS on native).
 */

import { createClientFsObjectStore } from '@pkgs/object-store/impl-client-fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { wallExpoFs } from '@pkgs/object-store/wall-expo-fs';

const PLAYGROUND_SNAPSHOT_BASE_DIR = 'playground-snapshots';

export function createPlaygroundSnapshotStore(): ObjectStore {
  return createClientFsObjectStore({
    baseDir: PLAYGROUND_SNAPSHOT_BASE_DIR,
    expoFs: wallExpoFs(),
  });
}
