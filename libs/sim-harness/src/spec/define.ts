/**
 * Step definers for product scenarios, bound to {@link SimWorld}. Importing
 * this registers the shared parameter types.
 *
 *   import { Given, When, Then } from '@libs/sim-harness/spec/define';
 *   When('{actor} removes {actor}', async (w, actor: Actor, other: Actor) => {
 *     await w.s.apply(removeFriend, actor, other);
 *   });
 */

import { defineParameterType, stepsFor } from '@pkgs/gherkin/registry';
import { SPEC_PARAMETER_TYPES } from './parameter-types';
import type { SimWorld } from './world';

for (const spec of SPEC_PARAMETER_TYPES) {
  defineParameterType(spec);
}

export const { Given, When, Then, Step } = stepsFor<SimWorld>();
export type { Actor } from './parameter-types';
export type { SimWorld } from './world';
