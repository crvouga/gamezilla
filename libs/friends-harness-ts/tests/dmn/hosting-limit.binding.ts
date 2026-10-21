/**
 * `specs/spaces/hosting-limit.dmn` against the permission system:
 *
 * - application decision — the kernel's counted-limit decision for the
 *   case's person (facts from the product's resolver) holding the case's
 *   number of open spaces;
 * - server enforcement — the real create-space mutation, replayed as the
 *   server replays it (authorize hook, then the body's hosting-limit check)
 *   against a server database where the person hosts that many open spaces:
 *   allowed opens the space, refused changes nothing and says why;
 * - client gating — the device's own create: the mutation client applying
 *   create-space locally over the device's synced spaces (what the create
 *   button does), refused locally with the same reason.
 */

import { clientGatingLayer } from '@libs/permissions-harness-ts/client';
import { hostingLimitApplicationLayer } from '@libs/permissions-shared-ts/application';
import type { ReasonWords } from '@libs/permissions-shared-ts/reasons';
import { HOSTING_LIMIT_REASONS } from '@libs/permissions-shared-ts/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions-shared-ts/server';
import {
  SPACE_TABLES,
  seedOpenSpaces,
} from '@libs/spaces-harness-ts/space-decision-world';
import { createSpaceMutation } from '@libs/spaces-shared-ts/create-space-mutation';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';

const ANOTHER = { spaceId: 'another-space' };

const hostAnother = replayOperation(createSpaceMutation, () => ANOTHER);

function refusedWith(code: string, words: ReasonWords) {
  return {
    answer: 'no',
    reason: words[code as keyof ReasonWords] ?? `unmapped: ${code}`,
  };
}

/** The create button's press: the device applies create-space locally. */
function createOnDevice() {
  const client = useMutationClient();
  return async () => {
    const result = await client.mutate(createSpaceMutation, ANOTHER);
    if (result.ok) return { answer: 'yes', reason: 'none' };
    return refusedWith(result.failures[0]?.code ?? '', HOSTING_LIMIT_REASONS);
  };
}

bindDecisions({
  spec: 'hosting-limit',
  layers: {
    'application decision': hostingLimitApplicationLayer(),
    'server enforcement': serverEnforcementLayer({
      tables: SPACE_TABLES,
      reasons: HOSTING_LIMIT_REASONS,
      seed: seedOpenSpaces,
      operationFor: () => hostAnother,
    }),
    'client gating': clientGatingLayer({
      tables: SPACE_TABLES,
      observes: ['answer', 'reason'],
      seed: seedOpenSpaces,
      mutations: {
        [createSpaceMutation.name]: createSpaceMutation,
      } as MutationRegistry,
      probe: createOnDevice,
    }),
  },
});
