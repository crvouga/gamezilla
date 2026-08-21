/**
 * Gzip-free SQLM dump of live sqlite-mem nodes for one UI frame.
 * Identical bytes reuse the same `frames/db/<sha>.sqlm` blob.
 */

import { createHash } from 'node:crypto';
import type { ObjectStore } from '@pkgs/object-store/interface';

import type { SimulationFrameDatabase } from '../types';
import { testFrameKey } from './keys';
import { storePutBytes } from './store-io';

export type SnapshotDatabaseNode = {
  readonly nodeId: string;
  readonly bytes: Uint8Array;
};

/**
 * Content-hash dump of live SQLM bytes for one UI frame.
 * Identical bytes reuse the same `frames/db/<sha>.sqlm` blob.
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
      file = `frames/db/${sha256}.sqlm`;
      const key = testFrameKey(args.runId, args.testId, file);
      await storePutBytes(
        args.store,
        key,
        node.bytes,
        'application/octet-stream'
      );
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
