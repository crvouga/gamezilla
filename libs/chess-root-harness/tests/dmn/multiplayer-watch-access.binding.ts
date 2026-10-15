import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { multiplayerRoomGrants } from '@libs/game-session-server/multiplayer-room-server';
import { clientGatingLayer } from '@libs/permissions-harness/client';
import { spaceRolesApplicationLayer } from '@libs/permissions-shared/application';
import { DMN_INPUT } from '@libs/permissions-shared/people';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import {
  OperationRefused,
  serverEnforcementLayer,
} from '@libs/permissions-shared/server';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import {
  memberIdOf,
  SPACE_ID,
  SPACE_TABLES,
  seedPlaceInSpace,
  seedPlaceInSpaceOnDevice,
} from '@libs/spaces-harness/space-decision-world';
import { bindDecisions } from '@pkgs/dmn-shared/registry';
import sql from '@pkgs/sql-root-shared/sql';

const application = spaceRolesApplicationLayer();
bindDecisions({
  spec: 'multiplayer-watch-access',
  layers: {
    'application decision': {
      observes: ['answer'],
      decide: (input, context) =>
        application.decide(
          { ...input, [DMN_INPUT.capability]: 'watch multiplayer chess' },
          context
        ),
    },
    'server enforcement': serverEnforcementLayer({
      tables: [...SPACE_TABLES, ...CHESS_TABLES],
      seed: async (c) => {
        await seedPlaceInSpace(c);
        await c.db.run(sql`INSERT INTO chess_multiplayer_players (id, owner_id, game_id)
          SELECT ${'watched-player'}, host_member_id, ${'watched-match'} FROM spaces WHERE id = ${SPACE_ID}`);
      },
      operationFor: () => async (c) => {
        const grants = await multiplayerRoomGrants({
          db: c.db,
          topic: 'chess-match:watched-match',
          nowMs: c.nowMs,
          actor: {
            memberId: memberIdOf(c),
            accountId: c.env.accountId ?? null,
            deviceId: c.env.deviceId!,
          },
        });
        if (!grants.includes(PERMISSION.gameMultiplayerWatch))
          throw new OperationRefused('not in the space');
      },
    }),
    'client gating': clientGatingLayer({
      tables: SPACE_TABLES,
      seed: seedPlaceInSpaceOnDevice,
      probe: () => {
        const can = useSpaceCan(SPACE_ID, PERMISSION.gameMultiplayerWatch);
        return () => ({ answer: can() ? 'yes' : 'no' });
      },
    }),
  },
});
