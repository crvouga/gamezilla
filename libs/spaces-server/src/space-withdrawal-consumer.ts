import { spaceRoomTopic } from '@libs/spaces-shared/space-room-topic';
import { ApplySpaceMembership } from '@libs/spaces-shared/space-service-command';
import { spaceRoomMembershipChanged } from '@libs/spaces-shared/space-withdrawal';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import type { SpaceBlockRelation } from './space-restrictions';
import { refreshSpaceRestrictions } from './space-restrictions';

export function registerSpaceWithdrawal(
  registry: OutboxConsumerRegistry,
  rooms: RoomServicePort,
  relation: SpaceBlockRelation | null = null
): void {
  registry.register({
    id: 'spaces-room-membership',
    on: spaceRoomMembershipChanged,
    handler: async (ctx, payload) => {
      await rooms.send(
        spaceRoomTopic(payload.spaceId),
        `space-membership:${payload.id}`,
        ApplySpaceMembership({
          memberId: payload.memberId,
          change: payload.change,
        })
      );
      if (payload.change === 'joined' && relation !== null)
        await refreshSpaceRestrictions({
          tx: ctx.tx,
          rooms,
          relation,
          spaceId: payload.spaceId,
          commandId: `space-restrictions:${payload.id}`,
        });
      if (payload.change !== 'joined')
        await rooms.disconnect(
          spaceRoomTopic(payload.spaceId),
          payload.change === 'ended' ? null : payload.memberId
        );
    },
  });
}
