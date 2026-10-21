/**
 * Which people of a scenario arrange their own private setups. A driver
 * readies anyone else with their side's known setup (`fixtures.setups`),
 * so a scenario that does not speak of setups still plays; a person whose
 * setup the scenario names, or who starts afresh with none (a rematch),
 * becomes ready with exactly what their own setup board holds.
 */

import type { ProductHarness } from '@libs/harness/harness';

const keeping = new WeakMap<ProductHarness, Set<string>>();

/** From now on `actor` becomes ready with what their setup board holds. */
export function keepOwnPrivateSetup(s: ProductHarness, actor: string): void {
  const people = keeping.get(s) ?? new Set<string>();
  people.add(actor);
  keeping.set(s, people);
}

/** Whether `actor` becomes ready with what their own setup board holds. */
export function keepsOwnPrivateSetup(
  s: ProductHarness,
  actor: string
): boolean {
  return keeping.get(s)?.has(actor) === true;
}
