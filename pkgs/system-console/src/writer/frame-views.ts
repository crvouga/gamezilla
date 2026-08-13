import type { ObjectStore } from '@pkgs/object-store/interface';

import type { SimulationFrameView } from '../types';
import { testFrameKey } from './keys';
import { storePutText } from './store-io';

export type SnapshotViewNode = {
  readonly nodeId: string;
  readonly html: string;
};

/** Sanitize actor ids for use in frame filenames. */
export function sanitizeViewNodeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'actor';
}

/**
 * Write per-actor HTML views for one frame sequence number.
 * Returns view metadata; caller still writes the primary `file` HTML.
 */
export async function writeFrameViewBlobs(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly frameSeq: number;
  readonly padFrame: (index: number) => string;
  readonly snapshotViews?: () => Promise<readonly SnapshotViewNode[]>;
  readonly onHtml?: (html: string) => void;
}): Promise<readonly SimulationFrameView[] | undefined> {
  if (!args.snapshotViews) return undefined;
  let nodes: readonly SnapshotViewNode[];
  try {
    nodes = await args.snapshotViews();
  } catch {
    return undefined;
  }
  if (nodes.length === 0) return [];
  const seq = args.padFrame(args.frameSeq);
  const out: SimulationFrameView[] = [];
  for (const node of nodes) {
    const safeId = sanitizeViewNodeId(node.nodeId);
    const file = `frames/f-${seq}.${safeId}.html`;
    const key = testFrameKey(args.runId, args.testId, file);
    await storePutText(args.store, key, node.html, 'text/html; charset=utf-8');
    args.onHtml?.(node.html);
    out.push({ nodeId: node.nodeId, file });
  }
  return out;
}

/** Prefer acting actor's view file; else first view; else undefined. */
export function pickPrimaryViewFile(
  views: readonly SimulationFrameView[] | undefined,
  actingActorId: string | undefined
): string | undefined {
  if (!views || views.length === 0) return undefined;
  if (actingActorId) {
    const match = views.find((v) => v.nodeId === actingActorId);
    if (match) return match.file;
  }
  return views[0]?.file;
}
