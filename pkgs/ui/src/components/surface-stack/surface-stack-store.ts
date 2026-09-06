/**
 * Ordered registry of open surfaces (modals / sheets). Z-index grows
 * monotonically with open order; a surface that remounts while siblings stay
 * open returns to its previous slot (underlay remount case).
 */

import { SURFACE_STACK_BASE, SURFACE_STACK_STEP } from './constants';

export type SurfaceStackEntry = {
  readonly id: string;
  readonly zIndex: number;
};

export type SurfaceStackSnapshot = readonly SurfaceStackEntry[];

export type SurfaceStackStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => SurfaceStackSnapshot;
  register: (id: string) => void;
  unregister: (id: string) => void;
  isTop: (id: string) => boolean;
  getTopId: () => string | null;
  zIndexOf: (id: string) => number | null;
};

const EMPTY_SNAPSHOT: SurfaceStackSnapshot = Object.freeze([]);

function zIndexForIndex(index: number): number {
  return SURFACE_STACK_BASE + index * SURFACE_STACK_STEP;
}

function insertAt(order: string[], id: string, index: number): string[] {
  const clamped = Math.max(0, Math.min(index, order.length));
  return [...order.slice(0, clamped), id, ...order.slice(clamped)];
}

export function createSurfaceStackStore(): SurfaceStackStore {
  let snapshot: SurfaceStackSnapshot = EMPTY_SNAPSHOT;
  let order: string[] = [];
  const restoreIndex = new Map<string, number>();
  const listeners = new Set<() => void>();

  const recompute = (): void => {
    snapshot =
      order.length === 0
        ? EMPTY_SNAPSHOT
        : Object.freeze(
            order.map((id, index) => ({ id, zIndex: zIndexForIndex(index) }))
          );
    for (const l of listeners) l();
  };

  return {
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSnapshot: () => snapshot,
    register: (id) => {
      if (order.includes(id)) return;
      const remembered = restoreIndex.get(id);
      restoreIndex.delete(id);
      order =
        remembered !== undefined && order.length > 0
          ? insertAt(order, id, remembered)
          : [...order, id];
      recompute();
    },
    unregister: (id) => {
      const index = order.indexOf(id);
      if (index < 0) return;
      // Remember slot only when siblings remain (underlay remount case).
      if (order.length > 1) restoreIndex.set(id, index);
      else restoreIndex.delete(id);
      order = order.filter((entryId) => entryId !== id);
      recompute();
    },
    isTop: (id) => order.length > 0 && order[order.length - 1] === id,
    getTopId: () => order[order.length - 1] ?? null,
    zIndexOf: (id) => {
      const index = order.indexOf(id);
      return index < 0 ? null : zIndexForIndex(index);
    },
  };
}
