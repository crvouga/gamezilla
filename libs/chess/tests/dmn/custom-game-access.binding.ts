import {
  performCustomGameDecision,
  seedCustomGameDecision,
} from '@libs/chess/harness/custom-game-decision-operations';
import { spaceRolesApplicationLayer } from '@libs/permissions/root/conformance/application';
import { grantKeyOf } from '@libs/permissions/root/conformance/capabilities';
import { clientGatingLayer } from '@libs/permissions/root/conformance/client';
import { capabilityOf } from '@libs/permissions/root/conformance/people';
import { serverEnforcementLayer } from '@libs/permissions/root/conformance/server';
import {
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces/harness/space-decision-world';
import { useSpaceCan } from '@libs/spaces/public/use-space-can';
import { bindDecisions } from '@pkgs/dmn/registry';

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
