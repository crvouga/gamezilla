import type { MutationDb } from '@pkgs/sync-engine-shared/mutations-types';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import sql, { join } from '@pkgs/sql-root-shared/sql';

// topic-map-db: a game's accepted people wake all open spaces they host, including watchers awaiting a match.
export async function multiplayerTopics(owners: readonly string[], db?: MutationDb): Promise<readonly Topic[]> {
  const ids = owners.filter(id => id.length > 0);
  const topics: Topic[] = ids.map(id => `user:${id}`);
  if (db !== undefined && ids.length > 0) {
    const spaces = await db.query(sql<{ id: string }>`SELECT id FROM spaces WHERE host_member_id IN (${join(ids)}) AND ended_at IS NULL AND deleted_at IS NULL`);
    topics.push(...spaces.map(space => `room:${space.id}` as Topic));
  }
  return topics;
}
