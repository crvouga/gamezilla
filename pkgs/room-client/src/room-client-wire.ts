import { assert } from '@pkgs/assert-shared/singleton';
import { cacheWasInvalidated } from '@pkgs/room-shared/cache-invalidation';
import type {
  LogEntry,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomState,
} from '@pkgs/room-shared/types';
import type {
  ROOM_WIRE_KIND,
  ServerToClientWire,
} from '@pkgs/room-shared/wire';
import type { ClientCore } from './room-client-core';
import {
  appendCommitted,
  dropQueued,
  rebase,
  resetCommitted,
  tryFastAck,
} from './room-client-core';
import type { RoomClientPersist } from './room-client-persist';

/**
 * Everything a wire applier needs, built once per client (not per frame).
 * Frames are applied synchronously; only persistence is deferred.
 */
export type WireEnv<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  readonly core: ClientCore<S, C, E, Identity>;
  readonly persist: RoomClientPersist;
  readonly sendSync: () => void;
  readonly flushOutbound: () => void;
  readonly reportError: (err: RoomError | Error) => void;
  readonly notify: () => void;
};

type AnyWireEnv = WireEnv<RoomState, RoomCommandPayload, RoomEvent, unknown>;
type Welcome = Extract<
  ServerToClientWire,
  { kind: typeof ROOM_WIRE_KIND.welcome }
>;
type Committed = Extract<
  ServerToClientWire,
  { kind: typeof ROOM_WIRE_KIND.committed }
>;
type Rejected = Extract<
  ServerToClientWire,
  { kind: typeof ROOM_WIRE_KIND.rejected }
>;

function resetToEmpty(env: AnyWireEnv): void {
  resetCommitted(env.core);
  env.persist.resetCommitted();
  rebase(env.core);
  env.notify();
}

function invalidateCache(env: AnyWireEnv): void {
  env.core.queue = [];
  env.persist.queueChanged();
  resetToEmpty(env);
  env.sendSync();
}

function welcomeSuffix(
  entries: readonly LogEntry[],
  lastSeq: number
): LogEntry[] {
  const out: LogEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.seq > lastSeq) out.push(e);
  }
  return out;
}

export function applyWelcome(env: AnyWireEnv, msg: Welcome): void {
  if (msg.fromSeq > 0 && cacheWasInvalidated(msg.entries))
    return invalidateCache(env);
  const core = env.core;
  const suffix = welcomeSuffix(msg.entries, core.lastSeq);
  const suffixContiguous =
    suffix.length === 0 || suffix[0]!.seq === core.lastSeq + 1;
  const serverBehind = msg.lastSeq < core.lastSeq;
  const behindWithoutEntries =
    suffix.length === 0 && msg.lastSeq > core.lastSeq;

  if (serverBehind || !suffixContiguous) {
    resetToEmpty(env);
    env.sendSync();
    return;
  }

  if (behindWithoutEntries) {
    if (msg.fromSeq === 0 && core.lastSeq === 0) {
      assert.ok(false, 'welcome lastSeq must match last applied entry seq', {
        lastSeq: core.lastSeq,
        msgLastSeq: msg.lastSeq,
      });
    }
    if (core.lastSeq !== 0) resetToEmpty(env);
    env.sendSync();
    return;
  }

  appendCommitted(core, suffix);
  env.persist.appendCommitted(suffix);
  rebase(core);
  if (msg.lastSeq !== core.lastSeq) {
    // Partial welcome (bounded batch) — keep progress, ask for the rest.
    env.notify();
    env.sendSync();
    return;
  }
  core.synced = true;
  env.notify();
  env.flushOutbound();
}

function ackQueued(env: AnyWireEnv, commandId: string): void {
  if (dropQueued(env.core, commandId) === 'overlay') rebase(env.core);
  env.persist.queueChanged();
}

export function applyCommitted(env: AnyWireEnv, msg: Committed): void {
  if (cacheWasInvalidated(msg.entries)) return invalidateCache(env);
  const core = env.core;
  const first = msg.entries[0];
  const commandId = msg.commandId;
  if (first !== undefined) {
    if (first.seq <= core.lastSeq) {
      // Duplicate / already-applied batch (dedup replay): only settle the ack.
      if (commandId !== undefined) {
        ackQueued(env, commandId);
        env.notify();
      }
      return;
    }
    if (first.seq !== core.lastSeq + 1) {
      core.synced = false;
      env.sendSync();
      env.notify();
      return;
    }
  }
  appendCommitted(core, msg.entries);
  env.persist.appendCommitted(msg.entries);
  if (commandId !== undefined && tryFastAck(core, commandId, msg.entries)) {
    env.persist.queueChanged();
  } else {
    if (commandId !== undefined) dropQueued(core, commandId);
    rebase(core);
    if (commandId !== undefined) env.persist.queueChanged();
  }
  env.notify();
}

export function applyRejected(env: AnyWireEnv, msg: Rejected): void {
  ackQueued(env, msg.commandId);
  env.reportError(msg.error);
  env.notify();
}
