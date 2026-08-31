import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { resolveQueryHydrates } from '../queries/core/define-query';
import type { QueryRegistry } from '../queries/core/types';
import { withFrameworkTopicMap } from '../shared/framework-topic-map';
import { warnPush } from '../shared/is-pubsub-closed-error';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { TopicMap } from '../shared/topic-map';
import { attachPush } from './attach-push';
import type { MergeApplierDeps } from './merge';
import type { OutboundLiveBuffer } from './optimistic-fanout';
import type { Timers } from './sim-ports';
import type { SubscriptionRuntime } from './subscription-runtime';

export type SyncEnginePushOptions = {
  readonly queryRegistry: QueryRegistry;
  /**
   * Return a live pubsub, or `null` when the transport is not ready yet
   * (missing broker URL, etc.). `null` / throw is poll-only: connect still
   * succeeds; `ensurePush` retries later.
   */
  readonly createPubSub: () => PubSub | null;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  /** When true, apply contiguous push row images (default false). */
  readonly rowImageFanout?: boolean;
  /**
   * When true, queue optimistic fanout while pubsub is detached / down and
   * flush on attach. Default false = skip (peers wait for upload/sync).
   */
  readonly bufferOutboundLive?: boolean;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
};

type PushAttachState = {
  readonly options: {
    readonly push?: SyncEnginePushOptions;
    readonly db: SqlClient;
    readonly timers: Timers;
  };
  readonly runtime: SubscriptionRuntime;
  readonly bus: {
    readonly subscribe: (
      listener: (tables: ReadonlySet<string>) => void
    ) => () => void;
  };
  readonly outboundLive: OutboundLiveBuffer | null;
  disposePush: (() => void) | null;
  refreshTopics: (() => void) | null;
  pushPubSub: PubSub | null;
};

function flushOutboundLive(state: PushAttachState): void {
  const pubsub = state.pushPubSub;
  const buf = state.outboundLive;
  if (pubsub === null || buf === null) return;
  void buf.flush(pubsub);
}

async function resolvePushQueryHydrates(
  registry: QueryRegistry
): Promise<void> {
  await Promise.all(
    Object.values(registry).map((query) => resolveQueryHydrates(query))
  );
}

function tryCreatePushPubSub(createPubSub: () => PubSub | null): PubSub | null {
  try {
    return createPubSub();
  } catch (error: unknown) {
    warnPush('[push] pubsub unavailable; continuing without live push', error);
    return null;
  }
}

function requirePushPubSub(createPubSub: () => PubSub | null): PubSub {
  const next = tryCreatePushPubSub(createPubSub);
  if (next === null) {
    throw new Error('pubsub unavailable');
  }
  return next;
}

function bindConfiguredPush(
  state: PushAttachState,
  push: SyncEnginePushOptions,
  created: PubSub,
  getMergeDeps: () => MergeApplierDeps
): void {
  let pubsub = created;
  state.pushPubSub = pubsub;
  const topicMap = withFrameworkTopicMap(push.topicMap);
  state.disposePush = attachPush({
    pubsub,
    runtime: state.runtime,
    queryRegistry: push.queryRegistry,
    getChannelsCtx: push.getChannelsCtx,
    db: state.options.db,
    getMergeDeps,
    ...(push.rowImageFanout === true ? { rowImageFanout: true } : {}),
    remakePubSub: () => {
      pubsub = requirePushPubSub(push.createPubSub);
      return pubsub;
    },
    onPubSubChanged: (next) => {
      state.pushPubSub = next;
      flushOutboundLive(state);
    },
    onBindTopicRefresh: (refresh) => {
      state.refreshTopics = refresh;
      push.onBindTopicRefresh?.(refresh);
    },
    ...(topicMap !== undefined ? { topicMap } : {}),
    ...(push.defaultEntryChannel !== undefined
      ? { defaultEntryChannel: push.defaultEntryChannel }
      : {}),
    timers: state.options.timers,
    onTablesChanged: (listener) => state.bus.subscribe(listener),
  });
  flushOutboundLive(state);
}

function abandonPushAttach(state: PushAttachState): void {
  try {
    state.disposePush?.();
  } catch {
    // dispose during teardown — pubsub already torn down (operating).
  }
  try {
    state.pushPubSub?.close();
  } catch {
    // close during teardown — already closed (operating).
  }
  state.disposePush = null;
  state.pushPubSub = null;
}

/** Attach MQTT/live push, or leave poll-only when pubsub is missing. */
export async function attachPushIfConfigured(
  state: PushAttachState,
  getMergeDeps: () => MergeApplierDeps
): Promise<void> {
  const push = state.options.push;
  if (push === undefined || state.disposePush !== null) {
    return;
  }
  try {
    await resolvePushQueryHydrates(push.queryRegistry);
    const created = tryCreatePushPubSub(push.createPubSub);
    if (created === null) return;
    bindConfiguredPush(state, push, created, getMergeDeps);
  } catch (error: unknown) {
    warnPush('[push] attach failed; continuing without live push', error);
    abandonPushAttach(state);
  }
}
