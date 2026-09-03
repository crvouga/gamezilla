import {
  type Action,
  defineAction,
  defineProperty,
  type Property,
} from '@pkgs/dst';
import type { Driver } from '../driver/driver';
import {
  EMPTY_INVENTORY,
  hasInventory,
  type Inventory,
  type InventoryItem,
} from './inventory';

export type Actor<S> = (s: S) => Driver | null;

async function readInventory(driver: Driver | null): Promise<Inventory> {
  if (driver === null) return EMPTY_INVENTORY;
  if (!hasInventory(driver)) return EMPTY_INVENTORY;
  return driver.inventory();
}

export async function inventory<S>(
  s: S,
  actor: Actor<S>
): Promise<Inventory> {
  return readInventory(actor(s));
}

export async function screen<S>(
  s: S,
  actor: Actor<S>
): Promise<string | null> {
  return (await inventory(s, actor)).screen;
}

export async function errors<S>(
  s: S,
  actor: Actor<S>
): Promise<readonly string[]> {
  return [...(await inventory(s, actor)).errors];
}

export function tap<S>(actor: Actor<S>): Action<S, [InventoryItem]> {
  return defineAction({
    name: 'tap',
    enabled: async (s) => (await inventory(s, actor)).pressables.length > 0,
    args: async (s) => {
      const inv = await inventory(s, actor);
      return (rng) => {
        const i = Math.floor(rng.next() * inv.pressables.length);
        return inv.pressables[i]!;
      };
    },
    act: async (s, target: InventoryItem) => {
      const d = actor(s);
      if (d === null) return;
      await d.get(target.testId).tap();
    },
  });
}

export function fill<S>(
  actor: Actor<S>
): Action<S, [InventoryItem, string]> {
  return defineAction({
    name: 'fill',
    enabled: async (s) => (await inventory(s, actor)).inputs.length > 0,
    args: async (s) => {
      const inv = await inventory(s, actor);
      return (rng) => {
        const i = Math.floor(rng.next() * inv.inputs.length);
        const target = inv.inputs[i]!;
        const text = `t${Math.floor(rng.next() * 1_000_000)}`;
        return [target, text] as [InventoryItem, string];
      };
    },
    act: async (s, target: InventoryItem, text: string) => {
      const d = actor(s);
      if (d === null) return;
      await d.get(target.testId).input(text);
    },
  });
}

export function back<S>(actor: Actor<S>): Action<S> {
  return defineAction({
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

export function scroll<S>(
  actor: Actor<S>
): Action<S, [(typeof SCROLL_DIRS)[number]]> {
  return defineAction({
    name: 'scroll',
    enabled: async (s) => {
      const inv = await inventory(s, actor);
      return inv.pressables.length > 0 || inv.inputs.length > 0;
    },
    args: (_s) => (rng) =>
      SCROLL_DIRS[Math.floor(rng.next() * SCROLL_DIRS.length)]!,
    act: async (s, dir: (typeof SCROLL_DIRS)[number]) => {
      const d = actor(s);
      if (d === null) return;
      const inv = await inventory(s, actor);
      const id = inv.pressables[0]?.testId ?? inv.inputs[0]?.testId;
      if (id === undefined) return;
      await d.get(id).scroll(dir);
    },
  });
}

export function noErrorBoundary<S>(actor: Actor<S>): Property<S, void> {
  return defineProperty({
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
  });
}

export function noConsoleError<S>(actor: Actor<S>): Property<S, void> {
  return defineProperty({
    name: 'noConsoleError',
    check: async (s) => {
      const errs = await errors(s, actor);
      if (errs.length > 0) {
        throw new Error(errs.join('; '));
      }
    },
  });
}
