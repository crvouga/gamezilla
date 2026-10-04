import type { EnvTime } from '@libs/feature-shared/sync';
import type { Timers } from '@pkgs/clock-shared/types';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import type { HarnessComposition, HarnessRoomNode } from './composition';
import { noRoomNode } from './composition';
import { harnessRoomGateway } from './room-gateway';
import type { HarnessSql } from './sql-types';

function buildRoomServerEnv(args: {
  readonly session: Session;
  readonly seed: bigint;
  readonly timers: Timers;
}): EnvTime {
  const { session, seed, timers } = args;
  return {
    clock: session.ports.clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed,
  };
}
export function createHarnessRooms(args: {
  readonly session: Session;
  readonly composition: HarnessComposition;
  readonly seed: bigint;
  readonly timers: Timers;
  readonly serverSql: HarnessSql;
}) {
  const { session, composition, seed, timers, serverSql } = args;
  const rooms: RoomServicePort = {
    read: (topic) => roomNode.services.read(topic),
    send: (topic, id, payload) => roomNode.services.send(topic, id, payload),
    eraseIdentity: (topic, identity, replacement) =>
      roomNode.services.eraseIdentity(topic, identity, replacement),
    disconnect: (topic, identity) =>
      roomNode.services.disconnect(topic, identity),
  };
  const roomNode: HarnessRoomNode =
    composition.roomNode?.(
      buildRoomServerEnv({ session, seed, timers }),
      harnessRoomGateway({
        composition,
        serverSql,
        clock: session.ports.clock,
        rooms,
      })
    ) ?? noRoomNode(composition.name);
  return { roomNode, rooms };
}
