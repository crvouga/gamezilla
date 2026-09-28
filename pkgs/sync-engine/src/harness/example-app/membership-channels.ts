import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryChannelsCtx } from '../../shared/push-payload';

/**
 * Identity-only channels ctx. Room topics come from held-row topic-map
 * projection in attachPush — no membership SQL here.
 */
export function createHarnessMembershipChannels(args: {
  readonly db: SqlClient;
  readonly actorId: string;
}): {
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
} {
  void args.db;
  return {
    onBindTopicRefresh: () => {
      // Held-row refresh is driven by table-change bus inside attachPush.
    },
    getChannelsCtx: () => ({
      actorId: args.actorId,
    }),
  };
}
