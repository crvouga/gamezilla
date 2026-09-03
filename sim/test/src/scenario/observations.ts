import type { JsonValue } from '@pkgs/dst';
import type { ElementLayout } from '@pkgs/ui-testing';
import type { Actor } from '@pkgs/ui-testing/explore';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';

import { defineObservation, type ProductSurface } from './system';
import { nodeAt, nodeKey } from './ui-nodes';

export function actor(id: string): Actor<ProductSurface> {
  return (s) => s.actors.get(id)?.ui ?? null;
}

export const anyActor: Actor<ProductSurface> = (s) => {
  const first = s.actors.values().next().value;
  return first?.ui ?? null;
};

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => [...s.sim.clientIds()] as string[],
});

export const actorIds = defineObservation({
  name: 'actorIds',
  observe: (s) => [...s.actors.keys()],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) => s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

/** Is the node at `path` currently on screen? Snapshot read, no waiting. */
export function visible(actorId: string, path: readonly string[]) {
  return defineObservation<boolean>({
    name: `visible(${nodeKey(actorId, path)})`,
    observe: async (s: ProductSurface) => {
      const node = nodeAt(s, actorId, path);
      if (node === null) return false;
      return node.isVisible();
    },
  });
}

/** Accessible / displayed text of the node at `path`. */
export function nodeText(actorId: string, path: readonly string[]) {
  return defineObservation<string | null>({
    name: `text(${nodeKey(actorId, path)})`,
    observe: async (s: ProductSurface) => {
      const node = nodeAt(s, actorId, path);
      if (node === null) return null;
      return node.text();
    },
  });
}

/**
 * Bounding box of the node at `path`. RNTL synthesizes `onLayout` on read so
 * measured canvases (chess board) become interactive.
 */
export function nodeLayout(actorId: string, path: readonly string[]) {
  return defineObservation<ElementLayout | null>({
    name: `layout(${nodeKey(actorId, path)})`,
    observe: async (s: ProductSurface) => {
      const node = nodeAt(s, actorId, path);
      if (node === null) return null;
      return node.layout();
    },
  });
}

export function actorHtml(actorId: string, stylesheetHref?: string) {
  return defineObservation<string | null>({
    name: `html(${actorId}:${stylesheetHref ?? ''})`,
    observe: async (s: ProductSurface) => {
      const handle = s.actors.get(actorId);
      if (handle === undefined) return null;
      return handle.ui.snapshotHtml(
        stylesheetHref === undefined ? undefined : { stylesheetHref }
      );
    },
  });
}

/** Token length recorded by the `devOauthSignIn` action (`null` = no token). */
export const oauthTokenLength = defineObservation({
  name: 'oauthTokenLength',
  observe: (s) => s.probes.oauthTokenLength,
});

/**
 * Snapshot recorded by the `captureSnapshot` action. `SimSystemSnapshot` is
 * structurally JSON but declared with readonly arrays, so it crosses the
 * observation boundary erased.
 */
export const capturedSnapshot = defineObservation({
  name: 'capturedSnapshot',
  observe: (s) => s.probes.snapshot as unknown as JsonValue,
});

export const PRODUCT_PROPERTIES = [noErrorBoundary(anyActor)];
