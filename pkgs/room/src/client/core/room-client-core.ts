import type { Assert } from '@pkgs/assert';
import { hotAssert } from '@pkgs/assert';
import { isNamespacedKeyword } from '@pkgs/keyword';
import { RoomCacheInvalidated } from '../../cache-invalidation';
import { plainDeepEqual } from '../../plain-deep-equal';
import type {
  HandleResult,
  LogEntry,
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';
import { roomAttrNamespace } from './room-meta';
import type { OptimisticEffectSession } from './room-optimistic-effects';
import type { QueuedCommand } from './storage';

/**
 * Mutable engine bookkeeping for one {@link RoomClient}. Plain record, mutated
 * in place on the hot path (dispatch / committed) — never exposed to callers.
 *
 * Invariant: `display` is always `committed ⊕ optimistic overlays of every
 * queued command`, maintained incrementally (O(events) per step) instead of
 * refolded from scratch on every read.
 */
export type ClientCore<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  readonly module: RoomModule<S, C, E, Identity>;
  readonly identity: Identity;
  /** `null` when the client has no effect handlers (hot path skips all bookkeeping). */
  readonly effects: OptimisticEffectSession | null;
  /** Optimistic events per queued command id (absent when local handle failed). */
  readonly optimistic: Map<string, E[]>;
  /** Dev-only cache of state keys already proven to be namespaced keywords. */
  readonly validatedKeys: Set<string> | null;
  committed: S;
  display: S;
  /** Committed log, appended in place. Readers go through {@link RoomClient.getLog}. */
  entries: LogEntry<E>[];
  lastSeq: number;
  /** Outbound queue, mutated in place; each row doubles as the {@link RoomCommand}. */
  queue: QueuedCommand[];
  synced: boolean;
  /** Cached copy handed out by `getLog()`; `null` after any log change. */
  logView: readonly LogEntry<E>[] | null;
};

export function createClientCore<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(args: {
  readonly module: RoomModule<S, C, E, Identity>;
  readonly identity: Identity;
  readonly effects: OptimisticEffectSession | null;
}): ClientCore<S, C, E, Identity> {
  const initial = args.module.initialState();
  const core: ClientCore<S, C, E, Identity> = {
    module: args.module,
    identity: args.identity,
    effects: args.effects,
    optimistic: new Map(),
    validatedKeys: hotAssert().isEnabled() ? new Set() : null,
    committed: initial,
    display: initial,
    entries: [],
    lastSeq: 0,
    queue: [],
    synced: false,
    logView: null,
  };
  validateStateKeys(core, initial);
  return core;
}

/**
 * Dev-only Tiger guard: module state must be a plain record whose keys are
 * namespaced keywords outside the reserved `room/*` namespace. Keys are
 * validated once and cached, so steady-state cost is a `Set` lookup per key
 * (no regex) and nothing at all in production builds.
 */
export function validateStateKeys(
  core: ClientCore<RoomState, RoomCommandPayload, RoomEvent, unknown>,
  state: RoomState
): void {
  const cache = core.validatedKeys;
  if (cache === null) return;
  const a: Assert = hotAssert();
  a.ok(
    state !== null && typeof state === 'object' && !Array.isArray(state),
    'Tiger: room module state must be a plain record'
  );
  const keys = Object.keys(state);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    if (cache.has(k)) continue;
    a.ok(
      !roomAttrNamespace.ownsKey(k),
      'Tiger: domain room module state must not use room/* keys (reserved for RoomMetaAttr)',
      { k }
    );
    a.ok(
      isNamespacedKeyword(k),
      'Tiger: room module state keys must be Clojure-style namespaced keywords (prefix/local)',
      { k }
    );
    cache.add(k);
  }
}

function reduceAll<S extends RoomState, E extends RoomEvent>(
  module: RoomModule<S, RoomCommandPayload, E, unknown>,
  state: S,
  events: readonly E[]
): S {
  let s = state;
  for (let i = 0; i < events.length; i++) s = module.reduce(s, events[i]!);
  return s;
}

/** Apply a contiguous committed batch to `committed` + log (O(batch)). */
export function appendCommitted<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(core: ClientCore<S, C, E, Identity>, batch: readonly LogEntry<E>[]): void {
  if (batch.length === 0) return;
  const a: Assert = hotAssert();
  let state = core.committed;
  let lastSeq = core.lastSeq;
  for (let i = 0; i < batch.length; i++) {
    const e = batch[i]!;
    a.ok(
      e.seq === lastSeq + 1,
      'log entries must extend lastSeq contiguously',
      { lastSeq, got: e.seq }
    );
    if (!RoomCacheInvalidated.is(e.event))
      state = core.module.reduce(state, e.event);
    core.entries.push(e);
    lastSeq = e.seq;
  }
  core.committed = state;
  core.lastSeq = lastSeq;
  core.logView = null;
  validateStateKeys(core, state);
}

/** Forget every committed entry (welcome told us our tail is unusable). */
export function resetCommitted<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(core: ClientCore<S, C, E, Identity>): void {
  core.committed = core.module.initialState();
  core.entries = [];
  core.lastSeq = 0;
  core.synced = false;
  core.logView = null;
}

function queueIds(queue: readonly QueuedCommand[]): string[] {
  const ids = new Array<string>(queue.length);
  for (let i = 0; i < queue.length; i++) ids[i] = queue[i]!.id;
  return ids;
}

/**
 * Re-derive every optimistic overlay on top of the current `committed` state
 * (the "rebase"). Commands whose local handle now fails keep their queue slot
 * (the server will answer them) but contribute nothing to `display`.
 */
export function rebase<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(core: ClientCore<S, C, E, Identity>): void {
  const { module, queue, optimistic, effects } = core;
  optimistic.clear();
  effects?.clear();
  let display = core.committed;
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i]!;
    const res = module.handle(display, q as RoomCommand<C>, core.identity);
    if (!res.ok) continue;
    optimistic.set(q.id, res.events);
    effects?.remember(q.id, res.effects ?? []);
    display = reduceAll(module, display, res.events);
  }
  core.display = display;
  validateStateKeys(core, display);
  if (effects !== null) void effects.refresh(queueIds(queue));
}

/**
 * Hot path: handle against `display`, overlay the events, enqueue.
 * Returns the module's verdict; a rejection leaves the core untouched.
 */
export function applyDispatch<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(core: ClientCore<S, C, E, Identity>, cmd: RoomCommand<C>): HandleResult<E> {
  const res = core.module.handle(core.display, cmd, core.identity);
  if (!res.ok) return res;
  const effects = res.effects ?? [];
  if (effects.length > 0 && core.effects === null) {
    throw new Error(
      'Tiger: handle produced effects but RoomClient has no effectHandlers'
    );
  }
  const display = reduceAll(core.module, core.display, res.events);
  core.display = display;
  validateStateKeys(core, display);
  core.queue.push(cmd);
  core.optimistic.set(cmd.id, res.events);
  if (core.effects !== null) void core.effects.applyNew(cmd.id, effects);
  return res;
}

export type DropOutcome = 'absent' | 'no-overlay' | 'overlay';

/** Remove a queued command by id (acks are usually the head → O(1) typical). */
export function dropQueued<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(core: ClientCore<S, C, E, Identity>, commandId: string): DropOutcome {
  const queue = core.queue;
  let index = -1;
  for (let i = 0; i < queue.length; i++) {
    if (queue[i]!.id === commandId) {
      index = i;
      break;
    }
  }
  const hadOverlay = core.optimistic.delete(commandId);
  core.effects?.forget(commandId);
  if (index === -1) return 'absent';
  queue.splice(index, 1);
  return hadOverlay ? 'overlay' : 'no-overlay';
}

/**
 * Own-command echo fast path: when the server committed exactly the events we
 * predicted for the head of the queue, `display` is already
 * `committed ⊕ remaining overlays`, so the rebase (re-handling every pending
 * command) can be skipped entirely. Returns `false` when a rebase is needed.
 */
export function tryFastAck<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(
  core: ClientCore<S, C, E, Identity>,
  commandId: string,
  entries: readonly LogEntry<E>[]
): boolean {
  const head = core.queue[0];
  if (head === undefined || head.id !== commandId) return false;
  const predicted = core.optimistic.get(commandId);
  if (predicted === undefined || predicted.length !== entries.length) {
    return false;
  }
  for (let i = 0; i < entries.length; i++) {
    if (!plainDeepEqual(predicted[i], entries[i]!.event)) return false;
  }
  core.queue.shift();
  core.optimistic.delete(commandId);
  const effects = core.effects;
  if (effects !== null) {
    effects.forget(commandId);
    void effects.refresh(queueIds(core.queue));
  }
  return true;
}
