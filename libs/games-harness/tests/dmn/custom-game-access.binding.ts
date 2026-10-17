import { clientGatingLayer } from '@libs/permissions-harness/client';
import { spaceRolesApplicationLayer } from '@libs/permissions-shared/application';
import { grantKeyOf } from '@libs/permissions-shared/capabilities';
import { capabilityOf } from '@libs/permissions-shared/people';
import { serverEnforcementLayer } from '@libs/permissions-shared/server';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import {
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness/space-decision-world';
import { bindDecisions } from '@pkgs/dmn-shared/registry';
import { gamesHeldTo } from '../conformance-world';
import {
  performCustomGameDecision,
  seedCustomGameDecision,
} from './custom-game-decision-operations';

/** Every game the table holds for. */
const GAMES = gamesHeldTo('specs/games/custom-game-access.dmn');

bindDecisions({
  spec: 'custom-game-access',
  layers: {
    'application decision': spaceRolesApplicationLayer(),
    'server enforcement': serverEnforcementLayer({
      tables: SPACE_TABLES,
      seed: seedCustomGameDecision,
      operationFor: () => performCustomGameDecision(GAMES),
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
