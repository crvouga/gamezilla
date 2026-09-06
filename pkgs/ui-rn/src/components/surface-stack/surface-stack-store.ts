/**
 * Ordered surface registry: later-open wins a higher z-index.
 * Pure store — no React. Used by {@link SurfaceStackProvider}.
 *
 * Re-registering an id that was unregistered while other surfaces stayed open
 * restores its prior index so remounted underlays do not steal the top.
 */

import type { ReactNode } from 'react';

import { SURFACE_STACK_BASE, SURFACE_STACK_STEP } from './constants';

export type SurfaceStackEntry = {
  readonly id: string;
  readonly node: ReactNode;
  readonly zIndex: number;
};

export type SurfaceStackSnapshot = ReadonlyArray<SurfaceStackEntry>;

export type SurfaceStackStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => SurfaceStackSnapshot;
  register: (id: string, node: ReactNode) => void;
  unregister: (id: string) => void;
  isTop: (id: string) => boolean;
  getTopId: () => string | null;
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
  const nodes = new Map<string, ReactNode>();
  /** Prior index for ids unregistered while siblings remained. */
  const restoreIndex = new Map<string, number>();
  const listeners = new Set<() => void>();

  const recompute = (): void => {
    if (order.length === 0) {
      snapshot = EMPTY_SNAPSHOT;
    } else {
      snapshot = Object.freeze(
        order.map((id, index) => {
          const node = nodes.get(id);
          if (node === undefined) {
            throw new Error(`surface-stack: missing node for id ${id}`);
          }
          return { id, node, zIndex: zIndexForIndex(index) };
        })
      );
    }
    listeners.forEach((l) => {
      l();
    });
  };

  return {
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSnapshot: () => snapshot,
    register: (id, node) => {
      const isNew = !nodes.has(id);
      const existing = nodes.get(id);
      if (!isNew && existing === node) return;
      nodes.set(id, node);
      if (isNew) {
        const remembered = restoreIndex.get(id);
        restoreIndex.delete(id);
        if (remembered !== undefined && order.length > 0) {
          order = insertAt(order, id, remembered);
        } else {
          order = [...order, id];
        }
      }
      recompute();
    },
    unregister: (id) => {
      const index = order.indexOf(id);
      if (!nodes.delete(id)) return;
      if (index >= 0) {
        // Remember slot only when siblings remain (underlay remount case).
        if (order.length > 1) restoreIndex.set(id, index);
        else restoreIndex.delete(id);
        order = order.filter((entryId) => entryId !== id);
      }
      recompute();
    },
    isTop: (id) => order.length > 0 && order[order.length - 1] === id,
    getTopId: () =>
      order.length === 0 ? null : (order[order.length - 1] ?? null),
  };
}
