import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { ElementLayout } from '@pkgs/ui-testing-root-shared-ts/driver';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';
import type { Actor } from '@pkgs/ui-testing-root-shared-ts/observations';
import type { ProductHarness } from './harness';
import { nodeAt } from './ui-nodes';

export function actor(id: string): Actor<ProductHarness> {
  return (s) => s.actors.get(id)?.ui ?? null;
}

export const anyActor: Actor<ProductHarness> = (s) => {
  const first = s.actors.values().next().value;
  return first?.ui ?? null;
};

export function caps(s: ProductHarness): string[] {
  return [...s.session.caps];
}

export function clientIds(s: ProductHarness): string[] {
  const fromHarness = [...s.harness.clientIds()];
  if (fromHarness.length > 0) return fromHarness;
  // Localhost bun-webview may spawn UI without in-heap clients.
  return [...s.actors.keys()];
}

/** Live API instance ids, in balancer rotation order. */
export function serverIds(s: ProductHarness): string[] {
  return [...s.harness.serverIds()];
}

/** Round-robin balancer state (backends, per-backend counts, recent routes). */
export function loadBalancer(s: ProductHarness) {
  return s.harness.loadBalancer.inspect();
}

export function actorIds(s: ProductHarness): string[] {
  return [...s.actors.keys()];
}

export function partitioned(s: ProductHarness): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

/**
 * Bring `actorId`'s app to the front, so snapshot reads (`visible`,
 * `nodeText`) see its screen: only one phone is on screen at a time, and a
 * parked actor's reads as empty. Records no gesture and waits for nothing.
 */
export async function bringToFront(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await nodeAt(s, actorId, [Handles.statusCurrentUser])
    ?.layout()
    .catch(() => null);
}

/** Is the node at `path` currently on screen? Snapshot read, no waiting. */
export async function visible(
  s: ProductHarness,
  actorId: string,
  path: readonly string[]
): Promise<boolean> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return false;
  return node.isVisible();
}

/** Accessible / displayed text of the node at `path`. */
export async function nodeText(
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  path: readonly string[]
): Promise<ElementLayout | null> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return null;
  return await node.layout();
}

export async function actorHtml(
  s: ProductHarness,
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
 * Snapshot recorded by the `captureSnapshot` action. `HarnessSystemSnapshot` is
 * structurally JSON but declared with readonly arrays.
 */
export function capturedSnapshot(s: ProductHarness) {
  return s.probes.snapshot;
}
