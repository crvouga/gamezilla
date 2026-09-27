import { Handles } from '@libs/test-ids';
import type { ElementLayout } from '@pkgs/ui-testing';
import { ElementNotFoundError } from '@pkgs/ui-testing';
import type { Actor } from '@pkgs/ui-testing/explore';
import type { ProductSim } from './sim';
import { nodeAt } from './ui-nodes';

export function actor(id: string): Actor<ProductSim> {
  return (s) => s.actors.get(id)?.ui ?? null;
}

export const anyActor: Actor<ProductSim> = (s) => {
  const first = s.actors.values().next().value;
  return first?.ui ?? null;
};

export function caps(s: ProductSim): string[] {
  return [...s.session.caps];
}

export function clientIds(s: ProductSim): string[] {
  const fromSim = [...s.sim.clientIds()];
  if (fromSim.length > 0) return fromSim;
  // Localhost bun-webview may spawn UI without in-heap clients.
  return [...s.actors.keys()];
}

/** Live API instance ids, in balancer rotation order. */
export function serverIds(s: ProductSim): string[] {
  return [...s.sim.serverIds()];
}

/** Round-robin balancer state (backends, per-backend counts, recent routes). */
export function loadBalancer(s: ProductSim) {
  return s.sim.loadBalancer.inspect();
}

export function actorIds(s: ProductSim): string[] {
  return [...s.actors.keys()];
}

export function partitioned(s: ProductSim): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

/**
 * Bring `actorId`'s app to the front, so snapshot reads (`visible`,
 * `nodeText`) see its screen: only one phone is on screen at a time, and a
 * parked actor's reads as empty. Records no gesture and waits for nothing.
 */
export async function bringToFront(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await nodeAt(s, actorId, [Handles.statusCurrentUser])
    ?.layout()
    .catch(() => null);
}

/** Is the node at `path` currently on screen? Snapshot read, no waiting. */
export async function visible(
  s: ProductSim,
  actorId: string,
  path: readonly string[]
): Promise<boolean> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return false;
  return node.isVisible();
}

/** Accessible / displayed text of the node at `path`. */
export async function nodeText(
  s: ProductSim,
  actorId: string,
  path: readonly string[]
): Promise<string | null> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return null;
  try {
    return await node.text();
  } catch (err) {
    // Not on screen right now (a live browser may be mid page load).
    if (err instanceof ElementNotFoundError) return null;
    throw err;
  }
}

/**
 * Bounding box of the node at `path`. The DOM driver synthesizes layout on
 * read so measured canvases (chess board) become interactive.
 */
export async function nodeLayout(
  s: ProductSim,
  actorId: string,
  path: readonly string[]
): Promise<ElementLayout | null> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return null;
  return await node.layout();
}

export async function actorHtml(
  s: ProductSim,
  actorId: string,
  stylesheetHref?: string
): Promise<string | null> {
  const handle = s.actors.get(actorId);
  if (handle === undefined) return null;
  return handle.ui.snapshotHtml(
    stylesheetHref === undefined ? undefined : { stylesheetHref }
  );
}

/**
 * Snapshot recorded by the `captureSnapshot` action. `SimSystemSnapshot` is
 * structurally JSON but declared with readonly arrays.
 */
export function capturedSnapshot(s: ProductSim) {
  return s.probes.snapshot;
}
