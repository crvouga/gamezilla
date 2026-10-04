import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import { spaceRoomTopic } from '@libs/spaces-shared/space-room-topic';
import { ApplySpaceMembership } from '@libs/spaces-shared/space-service-command';
import { spaceRoomMembershipChanged } from '@libs/spaces-shared/space-withdrawal';

export function registerSpaceWithdrawal(
  registry: OutboxConsumerRegistry,
  rooms: RoomServicePort
): void {
  registry.register({
    id: 'spaces-room-membership',
    on: spaceRoomMembershipChanged,
    handler: async (_ctx, payload) => {
      await rooms.send(
        spaceRoomTopic(payload.spaceId),
        `space-membership:${payload.id}`,
        ApplySpaceMembership({
          memberId: payload.memberId,
          change: payload.change,
        })
      );
      if (payload.change !== 'joined')
        await rooms.disconnect(
          spaceRoomTopic(payload.spaceId),
          payload.change === 'ended' ? null : payload.memberId
        );
    },
  });
}
