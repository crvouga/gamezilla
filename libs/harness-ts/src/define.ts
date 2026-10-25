/**
 * Step definers for product scenarios, bound to {@link HarnessWorld}. Importing
 * this registers the shared parameter types.
 *
 *   import { Given, When, Then } from '@libs/harness-ts/spec/define';
 *   When('{actor} removes {actor}', async (w, actor: Actor, other: Actor) => {
 *     await w.s.apply(removeFriend, actor, other);
 *   });
 */

import {
  defineParameterType,
  stepsFor,
} from '@pkgs/gherkin-shared-ts/registry';
import { SPEC_PARAMETER_TYPES } from './spec-parameter-types';
import type { HarnessWorld } from './spec-world';

for (const spec of SPEC_PARAMETER_TYPES) {
  defineParameterType(spec);
}

export const { Given, When, Then, Step } = stepsFor<HarnessWorld>();
