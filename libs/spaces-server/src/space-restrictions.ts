import {
  SpaceMembersRoomAttr,
  spaceRestrictionPairs,
  spaceSeatMemberIds,
} from '@libs/spaces-shared/space-members-messages';
import { spaceRoomTopic } from '@libs/spaces-shared/space-room-topic';
import { ApplySpaceRestrictions } from '@libs/spaces-shared/space-service-command';
import type { MessageTag } from '@pkgs/message-shared/message';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

/**
 * Who among some people has blocked whom, and the delivery saying it may have
 * changed: the friends context's published block relation, given to spaces by
 * the composition root.
 */
export type SpaceBlockRelation = {
  readonly blocks: (
    tx: SqlTx,
    people: readonly string[]
  ) => Promise<readonly (readonly [string, string])[]>;
  readonly changed: MessageTag<{
    readonly blockerId: string;
    readonly blockedId: string;
  }>;
};

/** Bring the blocks among a live space's members into its room. */
export async function refreshSpaceRestrictions(args: {
  readonly tx: SqlTx;
  readonly rooms: RoomServicePort;
  readonly relation: SpaceBlockRelation;
  readonly spaceId: string;
  readonly commandId: string;
}): Promise<void> {
  const topic = spaceRoomTopic(args.spaceId);
  const state = await args.rooms.read(topic);
  const blocks = await args.relation.blocks(args.tx, spaceSeatMemberIds(state));
  const pairs = spaceRestrictionPairs(blocks);
  const current = SpaceMembersRoomAttr.restrictions.from(state);
  if (JSON.stringify(pairs) === JSON.stringify(current)) return;
  await args.rooms.send(
    topic,
    args.commandId,
    ApplySpaceRestrictions({ blocks })
  );
}

async function liveSpacesOf(
  tx: SqlTx,
  people: readonly string[]
): Promise<readonly string[]> {
  const [first = '', second = ''] = people;
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT DISTINCT s.id
    FROM spaces s
    LEFT JOIN spaces_users u
      ON u.space_id = s.id AND u.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.ended_at IS NULL
      AND (
        u.user_id IN (${first}, ${second})
        OR s.host_member_id IN (${first}, ${second})
        OR s.host_account_id IN (${first}, ${second})
      )
    ORDER BY s.id
  `);
  return rows.map((row) => row.id);
}

/** A block or unblock reaches every live space either person is in. */
export function registerSpaceRestrictions(
  registry: OutboxConsumerRegistry,
  rooms: RoomServicePort,
  relation: SpaceBlockRelation
): void {
  registry.register({
    id: 'spaces-room-restrictions',
    on: relation.changed,
    handler: async (ctx, payload) => {
      const people = [payload.blockerId, payload.blockedId];
      for (const spaceId of await liveSpacesOf(ctx.tx, people))
        await refreshSpaceRestrictions({
          tx: ctx.tx,
          rooms,
          relation,
          spaceId,
          commandId: `space-restrictions:${ctx.createId()}`,
        });
    },
  });
}
