import { assert } from '@pkgs/assert';

import type { ROOM_WIRE_KIND, ServerToClientWire } from '../../protocol/wire';
import type { LogEntry, RoomActor, RoomError } from '../../types';

/** Mutable host surface for welcome / committed / rejected application. */
export type RoomClientWireHost = {
  readonly lastSeq: number;
  readonly committedEntries: LogEntry[];
  applyCommittedBatch(entries: LogEntry[]): void;
  applyOptimisticRebuild(): void;
  resetCommittedToEmpty(): Promise<void>;
  saveCommitted(): Promise<void>;
  dropQueued(commandId: string): void;
  removeQueued(commandId: string): Promise<void>;
  sendSync(): void;
  flushOutboundQueue(): Promise<void>;
  setSynced(v: boolean): void;
  setRoster(clients: readonly RoomActor[]): void;
  reportError(err: RoomError | Error): void;
  notify(): void;
};

export async function applyWelcomeWire(
  host: RoomClientWireHost,
  msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.welcome }>
): Promise<void> {
  const suffix = msg.entries.filter((e) => e.seq > host.lastSeq);
  const suffixContiguous =
    suffix.length === 0 || suffix[0]!.seq === host.lastSeq + 1;
  const serverBehind = msg.lastSeq < host.lastSeq;
  const behindWithoutEntries =
    suffix.length === 0 && msg.lastSeq > host.lastSeq;

  if (serverBehind || !suffixContiguous) {
    await host.resetCommittedToEmpty();
    host.sendSync();
    return;
  }

  if (behindWithoutEntries) {
    if (msg.fromSeq === 0 && host.lastSeq === 0) {
      assert.ok(false, 'welcome lastSeq must match last applied entry seq', {
        lastSeq: host.lastSeq,
        msgLastSeq: msg.lastSeq,
      });
    }
    if (host.lastSeq !== 0) await host.resetCommittedToEmpty();
    host.sendSync();
    return;
  }

  host.applyCommittedBatch(suffix);
  if (msg.lastSeq !== host.lastSeq) {
    // Partial welcome (bounded batch) — keep progress, ask for the rest.
    await host.saveCommitted();
    host.applyOptimisticRebuild();
    host.notify();
    host.sendSync();
    return;
  }
  await host.saveCommitted();
  host.applyOptimisticRebuild();
  host.setSynced(true);
  host.notify();
  await host.flushOutboundQueue();
}

export async function applyCommittedWire(
  host: RoomClientWireHost,
  msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.committed }>
): Promise<void> {
  const first = msg.entries[0];
  if (first !== undefined) {
    if (first.seq <= host.lastSeq) {
      if (typeof msg.commandId === 'string' && msg.commandId.length > 0) {
        host.dropQueued(msg.commandId);
        await host.removeQueued(msg.commandId);
        host.notify();
      }
      return;
    }
    if (first.seq !== host.lastSeq + 1) {
      host.setSynced(false);
      host.sendSync();
      host.notify();
      return;
    }
  }
  host.applyCommittedBatch(msg.entries);
  await host.saveCommitted();
  if (typeof msg.commandId === 'string' && msg.commandId.length > 0) {
    host.dropQueued(msg.commandId);
    await host.removeQueued(msg.commandId);
  }
  host.applyOptimisticRebuild();
  host.notify();
}

export async function applyRejectedWire(
  host: RoomClientWireHost,
  msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.rejected }>
): Promise<void> {
  host.dropQueued(msg.commandId);
  await host.removeQueued(msg.commandId);
  host.applyOptimisticRebuild();
  host.reportError(msg.error);
  host.notify();
}
