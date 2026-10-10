import { composeRoomGrants } from '@libs/sub-shared/compose-server';
import type { Clock } from '@pkgs/clock-shared/types';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';

import type { HarnessComposition, HarnessRoomGateway } from './composition';
import type { HarnessSql } from './sql-types';

/**
 * The API room gateway's decision for the in-process room node: the
 * composed subs' room grants, read from the server database at connect
 * time (billing plays no part in them).
 */
export function harnessRoomGateway(args: {
  readonly composition: HarnessComposition;
  readonly serverSql: HarnessSql;
  readonly clock: Clock;
  readonly rooms: RoomServicePort;
}): HarnessRoomGateway {
  let grants: ReturnType<typeof composeRoomGrants> | null = null;
  return {
    roomGrants: ({ topic, actor }) => {
      grants ??= composeRoomGrants(
        args.composition.servers({ billing: null, rooms: args.rooms })
      );
      return grants({
        db: args.serverSql.sqlClient,
        topic,
        actor,
        nowMs: args.clock.now(),
      });
    },
  };
}
