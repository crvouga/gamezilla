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
 * Missing actors reuse {@link lastGoodHtml} so parked clients keep a pane.
 * Returns view metadata; caller still writes the primary `file` HTML.
 */
export async function writeFrameViewBlobs(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly frameSeq: number;
  readonly padFrame: (index: number) => string;
  readonly snapshotViews?: () => Promise<readonly SnapshotViewNode[]>;
  /** nodeId → last non-blank HTML written for this test (mutated in place). */
  readonly lastGoodHtml?: Map<string, string>;
  readonly onHtml?: (html: string) => void;
}): Promise<readonly SimulationFrameView[] | undefined> {
  if (!args.snapshotViews) return undefined;
  let nodes: readonly SnapshotViewNode[];
  try {
    nodes = await args.snapshotViews();
  } catch {
    return undefined;
  }
  const merged = mergeWithLastGoodViews(nodes, args.lastGoodHtml);
  if (merged.length === 0) return [];
  const seq = args.padFrame(args.frameSeq);
  const out: SimulationFrameView[] = [];
  for (const node of merged) {
    const safeId = sanitizeViewNodeId(node.nodeId);
    const file = `frames/f-${seq}.${safeId}.html`;
    const key = testFrameKey(args.runId, args.testId, file);
    await storePutText(args.store, key, node.html, 'text/html; charset=utf-8');
    args.lastGoodHtml?.set(node.nodeId, node.html);
    args.onHtml?.(node.html);
    out.push({ nodeId: node.nodeId, file });
  }
  return out;
}

/** Live snapshots win; fill gaps from the last non-blank HTML per node. */
export function mergeWithLastGoodViews(
  nodes: readonly SnapshotViewNode[],
  lastGoodHtml: ReadonlyMap<string, string> | undefined
): SnapshotViewNode[] {
  const byId = new Map<string, SnapshotViewNode>();
  for (const node of nodes) {
    if (node.html.trim() === '') continue;
    byId.set(node.nodeId, node);
  }
  if (lastGoodHtml !== undefined) {
    for (const [nodeId, html] of lastGoodHtml) {
      if (byId.has(nodeId)) continue;
      if (html.trim() === '') continue;
      byId.set(nodeId, { nodeId, html });
    }
  }
  return [...byId.values()];
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
