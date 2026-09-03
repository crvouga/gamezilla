import type { Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { TopicMap } from '../shared/topic-map';
import type { InvariantViolation } from './invariants';

export type SimSessionQuery = {
  readonly name: string;
  readonly params: Record<string, unknown>;
};

export type SimPushChannels = {
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
};

/**
 * Pluggable domain for a sim system (schema + registries + converge check).
 * Injected by callers (fixtures / lab); sim has no built-in packs.
 */
export type SimDomainPack = {
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly sessionQuery: SimSessionQuery;
  readonly checkAllConverged: (args: {
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
  }) => SimPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
};

/** Default push channels when a pack does not supply membership wiring. */
export function emptySimPushChannels(actorId: string): SimPushChannels {
  return {
    getChannelsCtx: () => ({
      actorId,
    }),
    onBindTopicRefresh: () => undefined,
  };
}
