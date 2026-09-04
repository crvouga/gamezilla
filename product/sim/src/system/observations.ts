import type { ElementLayout } from '@pkgs/ui-testing';
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
  return [...s.sim.clientIds()];
}

export function actorIds(s: ProductSim): string[] {
  return [...s.actors.keys()];
}

export function partitioned(s: ProductSim): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
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
  return node.text();
}

/**
 * Bounding box of the node at `path`. RNTL synthesizes `onLayout` on read so
 * measured canvases (chess board) become interactive.
 */
export async function nodeLayout(
  s: ProductSim,
  actorId: string,
  path: readonly string[]
): Promise<ElementLayout | null> {
  const node = nodeAt(s, actorId, path);
  if (node === null) return null;
  return (await node.layout()) as ElementLayout | null;
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

/** Token length recorded by the `devOauthSignIn` action (`null` = no token). */
export function oauthTokenLength(s: ProductSim): number | null {
  return s.probes.oauthTokenLength;
}

/**
 * Snapshot recorded by the `captureSnapshot` action. `SimSystemSnapshot` is
 * structurally JSON but declared with readonly arrays.
 */
export function capturedSnapshot(s: ProductSim) {
  return s.probes.snapshot;
}
