import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { ObjectStore } from '@pkgs/object-store/interface';

import type { SimulationFrameDatabase } from '../types';
import { testFrameKey } from './keys';
import { storePutBytes } from './store-io';

export type SnapshotDatabaseNode = {
  readonly nodeId: string;
  readonly bytes: Uint8Array;
};

/**
 * Gzip + content-hash dump of live SQLite nodes for one UI frame.
 * Identical bytes reuse the same `frames/db/<sha>.sqlite.gz` blob.
 */
export async function writeFrameDatabaseBlobs(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly writtenDbBlobs: Map<string, string>;
  readonly snapshotDatabases?: () => Promise<readonly SnapshotDatabaseNode[]>;
}): Promise<readonly SimulationFrameDatabase[] | undefined> {
  if (!args.snapshotDatabases) return undefined;
  let nodes: readonly SnapshotDatabaseNode[];
  try {
    nodes = await args.snapshotDatabases();
  } catch {
    return undefined;
  }
  if (nodes.length === 0) return [];
  const out: SimulationFrameDatabase[] = [];
  for (const node of nodes) {
    const sha256 = sha256Hex(node.bytes);
    let file = args.writtenDbBlobs.get(sha256);
    if (file === undefined) {
      file = `frames/db/${sha256}.sqlite.gz`;
      const key = testFrameKey(args.runId, args.testId, file);
      const gzipped = gzipSync(node.bytes);
      await storePutBytes(args.store, key, gzipped, 'application/gzip');
      args.writtenDbBlobs.set(sha256, file);
    }
    out.push({
      nodeId: node.nodeId,
      file,
      sha256,
      byteLength: node.bytes.byteLength,
    });
  }
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
