/**
 * What the harness knows about how each person uses the app — by pointer, or
 * by the keyboard alone — and the keyboard facts an action records for a later
 * read (where the keyboard was before Settings opened, where Tab went). Kept
 * per harness, so each scenario starts with everyone using a pointer.
 */

import type { ProductHarness } from '@libs/harness/harness';

type Person = {
  keyboard: boolean;
  beforeSettings: string | null | undefined;
  visits: readonly string[] | undefined;
};

const people = new WeakMap<ProductHarness, Map<string, Person>>();

function person(s: ProductHarness, actorId: string): Person {
  const byActor = people.get(s) ?? new Map<string, Person>();
  people.set(s, byActor);
  const found = byActor.get(actorId);
  if (found !== undefined) return found;
  const fresh: Person = {
    keyboard: false,
    beforeSettings: undefined,
    visits: undefined,
  };
  byActor.set(actorId, fresh);
  return fresh;
}

export function useKeyboard(s: ProductHarness, actorId: string): void {
  person(s, actorId).keyboard = true;
}

export function usesKeyboard(s: ProductHarness, actorId: string): boolean {
  return person(s, actorId).keyboard;
}

export function recordKeyboardBeforeSettings(
  s: ProductHarness,
  actorId: string,
  place: string | null
): void {
  person(s, actorId).beforeSettings = place;
}

export function recordKeyboardVisits(
  s: ProductHarness,
  actorId: string,
  visits: readonly string[]
): void {
  person(s, actorId).visits = visits;
}

/** Where the keyboard was when the person set out to open Settings. */
export function keyboardBeforeSettings(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const place = person(s, actorId).beforeSettings;
  if (place === undefined) {
    throw new Error(`${actorId} has not opened Settings by keyboard`);
  }
  return Promise.resolve(place);
}

/** Every place the keyboard landed, in order, the last time it moved through. */
export function keyboardVisits(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  const visits = person(s, actorId).visits;
  if (visits === undefined) {
    throw new Error(`${actorId}'s keyboard has not moved through the page`);
  }
  return Promise.resolve(visits);
}
