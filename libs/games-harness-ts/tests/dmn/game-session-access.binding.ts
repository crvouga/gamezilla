import { spaceRolesApplicationLayer } from '@libs/permissions-harness-ts/application';
import { clientGatingLayer } from '@libs/permissions-harness-ts/client';
import { grantKeyOf } from '@libs/permissions-shared-ts/capabilities';
import { capabilityOf } from '@libs/permissions-shared-ts/people';
import { serverEnforcementLayer } from '@libs/permissions-shared-ts/server';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import {
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness-ts/space-decision-world';
import { bindDecisions } from '@pkgs/dmn-shared-ts/registry';
import { gamesHeldTo } from '../conformance-world';
import {
  performGameSessionDecision,
  seedGameSessionDecision,
} from './game-session-decision-operations';

/** Every game the table holds for. */
const GAMES = gamesHeldTo('specs/games/game-session-access.dmn');

bindDecisions({
  spec: 'game-session-access',
  layers: {
    'application decision': spaceRolesApplicationLayer(),
    'server enforcement': serverEnforcementLayer({
      tables: SPACE_TABLES,
      seed: seedGameSessionDecision,
      operationFor: () => performGameSessionDecision(GAMES),
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
