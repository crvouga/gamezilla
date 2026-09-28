/**
 * `specs/spaces/hosting-limit.dmn` against the permission system:
 *
 * - application decision — the kernel's counted-limit decision for the
 *   case's person (facts from the product's resolver) holding the case's
 *   number of open spaces;
 * - server enforcement — the real create-space mutation, replayed as the
 *   server replays it (authorize hook, then the body's hosting-limit check)
 *   against a server database where the person hosts that many open spaces:
 *   allowed opens the space, refused changes nothing and says why.
 */

import { hostingLimitApplicationLayer } from '@libs/permissions/root/conformance/application';
import { HOSTING_LIMIT_REASONS } from '@libs/permissions/root/conformance/reasons';
import {
  replayOperation,
  serverEnforcementLayer,
} from '@libs/permissions/root/conformance/server';
import { createSpaceMutation } from '@libs/spaces/root/mutations';
import { bindDecisions } from '@pkgs/dmn/registry';

import { SPACE_TABLES, seedOpenSpaces } from './space-world';

const hostAnother = replayOperation(createSpaceMutation, () => ({
  spaceId: 'another-space',
}));

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
  },
});
