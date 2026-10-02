import type { OutboxConsumerRegistry } from '@pkgs/outbox';
import type { RoomServicePort } from '@pkgs/room/server';
import { roomTopic } from '../../public/room/space-room-topic';
import { ApplySpaceMembership } from '../../shared/space/space-service-command';
import { spaceRoomMembershipChanged } from '../../shared/space/space-withdrawal';

export function registerSpaceWithdrawal(
  registry: OutboxConsumerRegistry,
  rooms: RoomServicePort
): void {
  registry.register({
    id: 'spaces-room-membership',
    on: spaceRoomMembershipChanged,
    handler: async (_ctx, payload) => {
      await rooms.send(
        roomTopic(payload.spaceId),
        `space-membership:${payload.id}`,
        ApplySpaceMembership({
          memberId: payload.memberId,
          change: payload.change,
        })
      );
      if (payload.change !== 'joined')
        await rooms.disconnect(
          roomTopic(payload.spaceId),
          payload.change === 'ended' ? null : payload.memberId
        );
    },
  });
}
