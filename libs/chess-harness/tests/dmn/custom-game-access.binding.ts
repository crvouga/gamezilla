import { performCustomGameDecision, seedCustomGameDecision } from '@libs/chess-harness/custom-game-decision-operations';
import { spaceRolesApplicationLayer } from '@libs/permissions-shared/application';
import { grantKeyOf } from '@libs/permissions-shared/capabilities';
import { clientGatingLayer } from '@libs/permissions-harness/client';
import { capabilityOf } from '@libs/permissions-shared/people';
import { serverEnforcementLayer } from '@libs/permissions-shared/server';
import {
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness/space-decision-world';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import { bindDecisions } from '@pkgs/dmn-shared/registry';

bindDecisions({
  spec: 'custom-game-access',
  layers: {
    'application decision': spaceRolesApplicationLayer(),
    'server enforcement': serverEnforcementLayer({
      tables: SPACE_TABLES,
      seed: seedCustomGameDecision,
      operationFor: () => performCustomGameDecision,
    }),
    'client gating': clientGatingLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpaceOnDevice,
      probe: (input) => {
        const can = useSpaceCan(SPACE_ID, grantKeyOf(capabilityOf(input)));
        return () => ({ answer: can() ? 'yes' : 'no' });
      },
    }),
  },
});
