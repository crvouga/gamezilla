import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { deriveScopeRowTopics } from '@pkgs/sync-engine-client-ts/attach-push-held-rows';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import { defineTopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

function databaseOf(tables: Readonly<Record<string, readonly QueryRow[]>>) {
  return {
    query: async (statement: Sql<unknown>) => {
      const table = /FROM\s+(\w+)/.exec(statement.text)?.[1] ?? '';
      return tables[table] ?? [];
    },
    run: async () => undefined,
  } as unknown as SqlClient;
}

// A membership names its room; the room's own row says whether it has ended.
const topicMap = defineTopicMap({
  spaces: {
    topics: () => [],
    subscribeTopics: () => [],
  },
  spaces_users: {
    topics: () => [],
    subscribeTopics: (row, _ctx, held) =>
      (held['spaces'] ?? []).some(
        (space) => space['id'] === row['space_id'] && space['ended_at'] != null
      )
        ? []
        : [`room:${String(row['space_id'])}`],
  },
});

// regression: mqtt-ended-space-rooms-never-granted
test('a membership consults the held rows of other subscription tables', async () => {
  const queryRegistry = {
    mySpaceUsers: { name: 'mySpaceUsers', hydrates: ['spaces_users'] },
  } as unknown as QueryRegistry;
  const topics = await deriveScopeRowTopics({
    db: databaseOf({
      spaces: [
        { id: 'live', ended_at: null, deleted_at: null },
        { id: 'over', ended_at: '2026-10-19T00:00:00.000Z', deleted_at: null },
      ],
      spaces_users: [
        { id: 'm1', space_id: 'live', user_id: 'me', deleted_at: null },
        { id: 'm2', space_id: 'over', user_id: 'me', deleted_at: null },
      ],
    }),
    queryRegistry,
    topicMap,
    defaultEntryChannel: undefined,
    channelsCtx: { actorId: 'me' },
    active: [{ scope: 'mySpaceUsers', name: 'mySpaceUsers', params: {} }],
  });
  expect(topics.get('mySpaceUsers')).toEqual(['room:live']);
});
