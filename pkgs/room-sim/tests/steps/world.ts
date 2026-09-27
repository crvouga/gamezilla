/**
 * The world a room scenario runs in: the room sim a `Given` opens (each
 * scenario picks its room app), disposed after the last step, plus values a
 * step hands to a later one (a baseline hash, a command frame).
 */

import {
  defineParameterType,
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { RoomSim } from '@pkgs/room-sim';
import type { Run } from '@pkgs/sim';

export type RoomWorld = {
  readonly ctx: ScenarioContext;
  sim: Run<RoomSim> | null;
  readonly memo: Map<string, unknown>;
};

export const { Given, When, Then } = stepsFor<RoomWorld>();

/** The open room; a scenario acts on it only after a `Given` opened one. */
export function room(w: RoomWorld): Run<RoomSim> {
  if (w.sim === null) {
    throw new Error(
      'no room is open — the scenario needs a Given that opens one'
    );
  }
  return w.sim;
}

export function remember<T>(w: RoomWorld, key: string, value: T): T {
  w.memo.set(key, value);
  return value;
}

export function recall<T>(w: RoomWorld, key: string): T {
  if (!w.memo.has(key)) {
    throw new Error(`no earlier step remembered "${key}"`);
  }
  return w.memo.get(key) as T;
}

/**
 * The parameter types the rooms features use, matching the spec gate's
 * registry (`SPEC_PARAMETER_TYPES` in `@libs/sim-harness`, which a `pkgs/`
 * package cannot import): `{actor}` is a person (White and Black are the
 * two sides of a match).
 */
defineParameterType({
  name: 'actor',
  regexp: /Alice|Bob|Carol|Dave|Eve|White|Black/,
  transformer: (name) => name.toLowerCase(),
});

export function useRoomWorld(): void {
  setWorld<RoomWorld>({
    create: async (ctx) => ({ ctx, sim: null, memo: new Map() }),
    dispose: async (w) => {
      await w.sim?.[Symbol.asyncDispose]();
    },
  });
}
