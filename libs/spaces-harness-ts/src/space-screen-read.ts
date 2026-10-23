import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql } from '@libs/harness-ts/identity';
import { bringToFront, visible } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import sql from '@pkgs/sql-root-shared-ts/sql';

export type SpaceScreen =
  | 'ended'
  | 'viewingPresence'
  | 'space'
  | 'lobby'
  | 'left'
  | 'droppedOut'
  | 'elsewhere';

/** The space or lobby a person can currently see. */
export async function spaceScreenOf(
  s: ProductHarness,
  actorId: string
): Promise<SpaceScreen> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.spaceEnded])) return 'ended';
  if (await visible(s, actorId, [Handles.spaceJoinPrompt])) return 'left';
  if (
    (await visible(s, actorId, [Handles.spaceHostOffline])) ||
    (await visible(s, actorId, [Handles.spacesNeedConnection]))
  )
    return 'droppedOut';
  // A guest told the connection is missing has dropped out of participation.
  // The host is told the same thing and keeps the space.
  const connectionMissing = await visible(s, actorId, [
    Handles.statusConnectionMissing,
  ]);
  const hostKeepsSpace = await visible(s, actorId, [Handles.spaceEnd]);
  if (
    connectionMissing &&
    !hostKeepsSpace &&
    (await visible(s, actorId, [Handles.spaceClose]))
  )
    return 'droppedOut';
  if (await visible(s, actorId, [Handles.spaceMembersClose]))
    return 'viewingPresence';
  if (await visible(s, actorId, [Handles.spaceClose])) return 'space';
  if (await visible(s, actorId, [Handles.spaceCreate])) return 'lobby';
  if (await visible(s, actorId, [Handles.spaceJoin])) return 'left';
  return 'elsewhere';
}

/** Context for an automated presence failure, without changing room state. */
export async function spacePresenceDiagnostics(
  s: ProductHarness
): Promise<string> {
  const routes = await Promise.all(
    [...s.actors.values()].map(async (actor) => ({
      actor: actor.id,
      path: await actor.currentPath(),
    }))
  );
  const rooms = s.harness.roomNode.listTopics().map((topic) => ({
    topic,
    room: s.harness.roomNode.inspect(topic),
  }));
  const participation = await Promise.all(
    [...s.actors.values()].map(async (actor) => ({
      actor: actor.id,
      rows: await actorLocalSql(s, actor.id)?.query(sql<
        Record<string, unknown>
      >`
        SELECT u.user_id, u.space_id, u.joined, u.participation_revision,
          u.deleted_at, o.device_id, o.participation_revision AS open_revision,
          o.deleted_at AS open_deleted_at
        FROM spaces_users AS u
        LEFT JOIN spaces_open_sessions AS o ON o.space_id = u.space_id
      `),
    }))
  );
  return JSON.stringify({ routes, rooms, participation });
}
