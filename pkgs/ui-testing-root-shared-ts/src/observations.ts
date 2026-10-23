import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { Action, PropertyDef } from '@pkgs/harness-root-shared-ts/effect';
import type { Rng } from '@pkgs/harness-root-shared-ts/rng';
import type { Driver } from './driver';
import type { Inventory, InventoryItem } from './inventory';
import { EMPTY_INVENTORY, hasInventory } from './inventory';

export type Actor<S> = (s: S) => Driver | null;

async function readInventory(driver: Driver | null): Promise<Inventory> {
  if (driver === null) return EMPTY_INVENTORY;
  if (!hasInventory(driver)) return EMPTY_INVENTORY;
  return driver.inventory();
}

export async function inventory<S>(s: S, actor: Actor<S>): Promise<Inventory> {
  return readInventory(actor(s));
}

export async function screen<S>(s: S, actor: Actor<S>): Promise<string | null> {
  return (await inventory(s, actor)).screen;
}

export async function errors<S>(
  s: S,
  actor: Actor<S>
): Promise<readonly string[]> {
  return [...(await inventory(s, actor)).errors];
}

export function tap<S>(actor: Actor<S>): Action<S, [InventoryItem]> {
  return defineAction<S, [InventoryItem]>({
    name: 'tap',
    enabled: async (s) => (await inventory(s, actor)).pressables.length > 0,
    sample: async (s) => {
      const inv = await inventory(s, actor);
      return (rng: Rng) => {
        const i = Math.floor(rng.next() * inv.pressables.length);
        return inv.pressables[i]!;
      };
    },
    act: async (s, target) => {
      const d = actor(s);
      if (d === null) return;
      await d.get(target.testId).tap();
    },
  });
}

export function fill<S>(actor: Actor<S>): Action<S, [InventoryItem, string]> {
  return defineAction<S, [InventoryItem, string]>({
    name: 'fill',
    enabled: async (s) => (await inventory(s, actor)).inputs.length > 0,
    sample: async (s) => {
      const inv = await inventory(s, actor);
      return (rng: Rng) => {
        const i = Math.floor(rng.next() * inv.inputs.length);
        const target = inv.inputs[i]!;
        const text = `t${Math.floor(rng.next() * 1_000_000)}`;
        return [target, text] as [InventoryItem, string];
      };
    },
    act: async (s, target, text) => {
      const d = actor(s);
      if (d === null) return;
      await d.get(target.testId).input(text);
    },
  });
}

export function back<S>(actor: Actor<S>): Action<S> {
  return defineAction<S>({
    name: 'back',
    enabled: async (s) => (await inventory(s, actor)).canGoBack,
    act: async (s) => {
      const d = actor(s);
      if (d === null) return;
      await d.key('escape');
    },
  });
}

const SCROLL_DIRS = ['up', 'down', 'left', 'right'] as const;
type ScrollDir = (typeof SCROLL_DIRS)[number];

export function scroll<S>(actor: Actor<S>): Action<S, [ScrollDir]> {
  return defineAction<S, [ScrollDir]>({
    name: 'scroll',
    enabled: async (s) => {
      const inv = await inventory(s, actor);
      return inv.pressables.length > 0 || inv.inputs.length > 0;
    },
    sample: () => (rng: Rng) =>
      SCROLL_DIRS[Math.floor(rng.next() * SCROLL_DIRS.length)]!,
    act: async (s, dir) => {
      const d = actor(s);
      if (d === null) return;
      const inv = await inventory(s, actor);
      const id = inv.pressables[0]?.testId ?? inv.inputs[0]?.testId;
      if (id === undefined) return;
      await d.get(id).scroll(dir);
    },
  });
}

/**
 * Property defs are registered by the owning system
 * (`defineProperty(noErrorBoundary(actor))` on the owning system) — there is no free property.
 */
export function noErrorBoundary<S>(actor: Actor<S>): PropertyDef<S> {
  return {
    name: 'noErrorBoundary',
    check: async (s) => {
      const errs = await errors(s, actor);
      const boundary = errs.filter((e) =>
        e.toLowerCase().includes('error boundary')
      );
      if (boundary.length > 0) {
        throw new Error(boundary.join('; '));
      }
    },
  };
}

export function noConsoleError<S>(actor: Actor<S>): PropertyDef<S> {
  return {
    name: 'noConsoleError',
    check: async (s) => {
      const errs = await errors(s, actor);
      if (errs.length > 0) {
        throw new Error(errs.join('; '));
      }
    },
  };
}
