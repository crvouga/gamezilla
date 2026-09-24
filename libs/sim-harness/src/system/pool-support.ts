/**
 * Shared helpers for explore-capable `defineAction`s: pick an actor id and
 * gate on a ready tab shell. Keeps pool predicates out of individual files.
 */

import type { Rng } from '@pkgs/sim';

import { actorIds } from './observations';
import type { ProductSim } from './sim';
import { tabsVisible } from './ui-reads';

export const EXPLORE_ACTOR_NAMES = ['alice', 'bob', 'carol'] as const;

export function pickId(ids: readonly string[], rng: Rng): string {
  return ids[Math.floor(rng.next() * ids.length)] ?? '';
}

export function freeExploreActorIds(s: ProductSim): string[] {
  const used = new Set(actorIds(s));
  return EXPLORE_ACTOR_NAMES.filter((id) => !used.has(id));
}

export async function readyActorIds(s: ProductSim): Promise<string[]> {
  const ready: string[] = [];
  for (const id of actorIds(s)) {
    try {
      if (await tabsVisible(s, id)) ready.push(id);
    } catch {
      // Actor still booting or chrome missing — skip for this step.
    }
  }
  return ready;
}

export function sampleActorId(s: ProductSim): (rng: Rng) => string {
  const ids = actorIds(s);
  return (rng) => pickId(ids, rng);
}

export async function sampleReadyActorId(
  s: ProductSim
): Promise<(rng: Rng) => string> {
  const ids = await readyActorIds(s);
  return (rng) => pickId(ids, rng);
}
