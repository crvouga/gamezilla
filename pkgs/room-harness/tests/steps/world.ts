/**
 * The world a room scenario runs in: the example game room a `Given` opens,
 * disposed after the last step.
 */

import { defineParameterType, setWorld, stepsFor } from '@pkgs/gherkin-shared/registry';
import type { ScenarioContext } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';
import type { RoomHarness } from '@pkgs/room-harness/harness';

export type RoomWorld = {
  readonly ctx: ScenarioContext;
  harness: Run<RoomHarness> | null;
};

export const { Given, When, Then } = stepsFor<RoomWorld>();

/** The open room; a scenario acts on it only after a `Given` opened one. */
export function room(w: RoomWorld): Run<RoomHarness> {
  if (w.harness === null) {
    throw new Error(
      'no room is open — the scenario needs a Given that opens one'
    );
  }
  return w.harness;
}

/**
 * The parameter types the room features use, matching the spec gate's
 * registry (`SPEC_PARAMETER_TYPES` in `@libs/harness`, which a `pkgs/`
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
    create: async (ctx) => ({ ctx, harness: null }),
    dispose: async (w) => {
      await w.harness?.[Symbol.asyncDispose]();
    },
  });
}
