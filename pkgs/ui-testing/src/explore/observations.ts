import {
  type Action,
  defineAction,
  defineObservation,
  defineProperty,
  draw,
  type JsonValue,
  type Observation,
  type Property,
} from '@pkgs/dst';
import type { Driver } from '../driver/driver';
import { EMPTY_INVENTORY, hasInventory, type Inventory } from './inventory';

export type Actor<S> = (s: S) => Driver | null;

async function readInventory(driver: Driver | null): Promise<Inventory> {
  if (driver === null) return EMPTY_INVENTORY;
  if (!hasInventory(driver)) return EMPTY_INVENTORY;
  return driver.inventory();
}

export function inventory<S>(actor: Actor<S>): Observation<S, [], JsonValue> {
  return defineObservation({
    name: 'inventory',
    observe: async (s) =>
      (await readInventory(actor(s))) as unknown as JsonValue,
  });
}

export function screen<S>(actor: Actor<S>): Observation<S, [], JsonValue> {
  return defineObservation({
    name: 'screen',
    observe: async (s) => (await readInventory(actor(s))).screen,
  });
}

export function errors<S>(actor: Actor<S>): Observation<S, [], JsonValue> {
  return defineObservation({
    name: 'errors',
    observe: async (s) => [...(await readInventory(actor(s))).errors],
  });
}

export function tap<S>(actor: Actor<S>): Action<S> {
  return defineAction({
    name: 'tap',
    *generate() {
      const inv = (yield* inventory(actor)) as unknown as Inventory;
      if (inv.pressables.length === 0) return;
      const target = yield* draw((rng) => {
        const i = Math.floor(rng.next() * inv.pressables.length);
        return inv.pressables[i]!;
      });
      yield async (s: S) => {
        const d = actor(s);
        if (d === null) return;
        await d.get(target.testId).tap();
      };
    },
  });
}

export function fill<S>(actor: Actor<S>): Action<S> {
  return defineAction({
    name: 'fill',
    *generate() {
      const inv = (yield* inventory(actor)) as unknown as Inventory;
      if (inv.inputs.length === 0) return;
      const target = yield* draw((rng) => {
        const i = Math.floor(rng.next() * inv.inputs.length);
        return inv.inputs[i]!;
      });
      const text = yield* draw(
        (rng) => `t${Math.floor(rng.next() * 1_000_000)}`
      );
      yield async (s: S) => {
        const d = actor(s);
        if (d === null) return;
        await d.get(target.testId).input(text);
      };
    },
  });
}

export function back<S>(actor: Actor<S>): Action<S> {
  return defineAction({
    name: 'back',
    *generate() {
      const inv = (yield* inventory(actor)) as unknown as Inventory;
      if (!inv.canGoBack) return;
      yield async (s: S) => {
        const d = actor(s);
        if (d === null) return;
        await d.key('escape');
      };
    },
  });
}

export function scroll<S>(actor: Actor<S>): Action<S> {
  return defineAction({
    name: 'scroll',
    *generate() {
      const inv = (yield* inventory(actor)) as unknown as Inventory;
      if (inv.pressables.length === 0 && inv.inputs.length === 0) return;
      const dir = yield* draw(
        (rng) =>
          (['up', 'down', 'left', 'right'] as const)[
            Math.floor(rng.next() * 4)
          ]!
      );
      yield async (s: S) => {
        const d = actor(s);
        if (d === null) return;
        const id = inv.pressables[0]?.testId ?? inv.inputs[0]?.testId;
        if (id === undefined) return;
        await d.get(id).scroll(dir);
      };
    },
  });
}

export function noErrorBoundary<S>(actor: Actor<S>): Property<S> {
  return defineProperty({
    name: 'noErrorBoundary',
    *watch() {
      const errs = (yield* errors(actor)) as string[];
      const boundary = errs.filter((e) =>
        e.toLowerCase().includes('error boundary')
      );
      if (boundary.length > 0) {
        throw new Error(boundary.join('; '));
      }
    },
  });
}

export function noConsoleError<S>(actor: Actor<S>): Property<S> {
  return defineProperty({
    name: 'noConsoleError',
    *watch() {
      const errs = (yield* errors(actor)) as string[];
      if (errs.length > 0) {
        throw new Error(errs.join('; '));
      }
    },
  });
}
