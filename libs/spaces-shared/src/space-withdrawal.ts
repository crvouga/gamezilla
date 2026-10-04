import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';

export const spaceRoomMembershipChanged = createMessageNamespace(
  'space',
  'membership'
)(
  'changed',
  (
    value
  ): value is {
    id: string;
    spaceId: string;
    memberId: string;
    change: 'joined' | 'left' | 'ended';
  } =>
    isPlainRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['spaceId'] === 'string' &&
    typeof value['memberId'] === 'string' &&
    ['joined', 'left', 'ended'].includes(String(value['change']))
);

export async function changeSpaceRoomMembership(
  ctx: MutationCtx,
  spaceId: string,
  change: 'joined' | 'left' | 'ended'
): Promise<void> {
  const id = ctx.env.createId();
  await new Outbox(ctx).send({
    id,
    message: spaceRoomMembershipChanged({
      id,
      spaceId,
      memberId: ctx.env.accountId ?? ctx.env.actorId,
      change,
    }),
  });
}
