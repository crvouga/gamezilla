/**
 * Monkey steps for a feature's own random walk (`s.randomActions`). A walk
 * action picks a ready actor, asks `applies` whether the step makes sense on
 * the screen that actor is on, and does nothing when it does not — a random
 * walk constantly draws steps the UI cannot take right now, and that is not a
 * failure. Once `applies` says yes, `act` runs unguarded: a control that is
 * there but does not work (a tap that never lands, a screen that never comes)
 * is a violation the walk reports, not noise it swallows.
 */

import { type Action, defineAction, type Rng } from '@pkgs/sim';
import type { Driver } from '@pkgs/ui-testing';

import { actorUi } from './actor-ui';
import { readyActorIds, sampleReadyActorId } from './pool-support';
import type { ProductSim } from './sim';

export type WalkStep = {
  readonly s: ProductSim;
  readonly actorId: string;
  readonly ui: Driver;
  /** A per-step draw, for walks that pick a value (a username, a move). */
  readonly pick: number;
};

export type WalkActionDef = {
  readonly name: string;
  readonly weight?: number;
  /** The step makes sense on the actor's current screen. */
  readonly applies: (step: WalkStep) => Promise<boolean>;
  readonly act: (step: WalkStep) => Promise<void>;
};

const taken = new WeakMap<ProductSim, Record<string, number>>();

/** Walk steps that applied (and so ran) in this sim, by action name. */
export function walkStepsTaken(
  s: ProductSim
): Readonly<Record<string, number>> {
  return { ...(taken.get(s) ?? {}) };
}

export function walkAction(
  def: WalkActionDef
): Action<ProductSim, [string, number]> {
  return defineAction({
    name: def.name,
    ...(def.weight === undefined ? {} : { weight: def.weight }),
    enabled: async (s: ProductSim) => (await readyActorIds(s)).length > 0,
    sample: async (s: ProductSim) => {
      const actor = await sampleReadyActorId(s);
      return (rng: Rng): [string, number] => [actor(rng), rng.next()];
    },
    act: async (s: ProductSim, actorId: string, pick: number) => {
      if (actorId === '') return;
      const step: WalkStep = {
        s,
        actorId,
        ui: await actorUi(s, actorId),
        pick,
      };
      if (!(await def.applies(step))) return;
      const counts = taken.get(s) ?? {};
      counts[def.name] = (counts[def.name] ?? 0) + 1;
      taken.set(s, counts);
      await def.act(step);
    },
  });
}

/** `handle` is on screen for the step's actor. */
export function visible(step: WalkStep, handle: string): Promise<boolean> {
  return step.ui.get(handle).isVisible();
}
