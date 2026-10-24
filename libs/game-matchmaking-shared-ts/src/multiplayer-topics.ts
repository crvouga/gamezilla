import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';

// topic-map-db: a game's accepted people wake all open spaces they host, including watchers awaiting a match.
export async function multiplayerTopics(
  owners: readonly string[],
  db?: MutationDb
): Promise<readonly Topic[]> {
  return (await multiplayerTopicsByRow([owners], db))[0]!;
}

/** One fresh hosted-space read with each input row's destinations kept separate. */
export async function multiplayerTopicsByRow(
  ownersByRow: readonly (readonly string[])[],
  db?: MutationDb
): Promise<readonly (readonly Topic[])[]> {
  const people = ownersByRow.map((owners) => [
    ...new Set(owners.filter((id) => id.length > 0)),
  ]);
  const ids = [...new Set(people.flat())];
  const spaces =
    db === undefined || ids.length === 0
      ? []
      : await db.query(sql<{ id: string; host_member_id: string }>`
          SELECT id, host_member_id FROM spaces WHERE host_member_id IN (${join(ids)})
          AND ended_at IS NULL AND deleted_at IS NULL`);
  return people.map((owners): Topic[] => [
    ...owners.map((id): Topic => `user:${id}`),
    ...spaces
      .filter((space) => owners.includes(space.host_member_id))
      .map((space): Topic => `room:${space.id}`),
  ]);
}
