import { assert } from '@pkgs/assert';

import { validateMutationInvalidates } from '../../shared/validate-topics';
import type { Mutation, MutationRegistry } from './types';

export function mutationRegistry(
  ms: readonly Mutation<unknown>[]
): MutationRegistry {
  const out: Record<string, Mutation<unknown>> = {};
  for (const m of ms) {
    assert.ok(out[m.name] === undefined, `Duplicate mutation name: ${m.name}`);
    validateMutationInvalidates(m);
    out[m.name] = m;
  }
  return out;
}
