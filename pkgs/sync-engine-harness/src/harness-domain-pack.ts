import type { Topic } from '@pkgs/pubsub-shared/topic';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import type { MutationRegistry } from '@pkgs/sync-engine-shared/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import type { QueryChannelsCtx } from '@pkgs/sync-engine-shared/push-payload';
import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import type { InvariantViolation } from './invariant-tracker';

export type HarnessSessionQuery = {
  readonly name: string;
  readonly params: Record<string, unknown>;
};

export type HarnessPushChannels = {
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
};

/**
 * Pluggable domain for a harness system (schema + registries + converge check).
 * Injected by callers (fixtures / lab); harness has no built-in packs.
 */
export type HarnessDomainPack = {
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly sessionQuery: HarnessSessionQuery;
  readonly checkAllInSync: (args: {
    readonly clients: readonly {
      readonly label: string;
      readonly db: SqlClient;
    }[];
    readonly serverDb: SqlClient;
  }) => Promise<InvariantViolation | null>;
  /** Optional push channel wiring. Default: actor-only empty membership. */
  readonly createPushChannels?: (args: {
    readonly db: SqlClient;
    readonly actorId: string;
  }) => HarnessPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
  /**
   * Corrupt one domain row for storage-tamper chaos. Required when fuzzing
   * `flipDomainRow`.
   */
  readonly tamperDomainRow?: (db: SqlClient) => Promise<void>;
  /** Topic to drop in pubsub chaos arbs (`dropTopic` fault). */
  readonly fuzzDropTopic?: Topic;
};

/** Default push channels when a pack does not supply membership wiring. */
export function emptyHarnessPushChannels(actorId: string): HarnessPushChannels {
  return {
    getChannelsCtx: () => ({
      actorId,
    }),
    onBindTopicRefresh: () => undefined,
  };
}
