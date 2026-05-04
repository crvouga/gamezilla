import { CounterModule } from '@gamezilla/domain/spaces/counter-room-module';
import type { SpaceMembershipRole } from '@gamezilla/domain/spaces/space-entities';
import type {
  RoomConfig,
  RoomPersistence,
  WebSocketRoomTransport,
} from '@gamezilla/room';

export function buildSpaceRoomConfig(args: {
  topic: string;
  roomSecret: string;
  secretSeed: Uint8Array;
  persistence: RoomPersistence;
  transport: WebSocketRoomTransport;
  role: SpaceMembershipRole;
  initialMembership: Record<string, number>;
  initialMemberPublicKeys: Record<string, string>;
  onSync: () => void;
}): RoomConfig {
  const {
    topic,
    roomSecret,
    secretSeed,
    persistence,
    transport,
    role,
    initialMembership,
    initialMemberPublicKeys,
    onSync,
  } = args;

  if (role === 'host') {
    return {
      topic,
      module: CounterModule,
      persistence,
      transport,
      roomSecret,
      secretSeed,
      role: { type: 'host', initialMembership, initialMemberPublicKeys },
      onSync,
    };
  }
  return {
    topic,
    module: CounterModule,
    persistence,
    transport,
    roomSecret,
    secretSeed,
    role: {
      type: 'join',
      roomSnapshot: { initialMembership, initialMemberPublicKeys },
    },
    onSync,
  };
}
