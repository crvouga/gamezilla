import { expect } from 'bun:test';
import { readTally } from '@pkgs/room-root-harness/game-room';
import type { LogEntry } from '@pkgs/room-root-shared/types';
import type { AsyncCommand } from 'fast-check';
import type { Change, ClientRig } from './client-rig';
import { committed, openClient, tallyEntry, welcome } from './client-rig';
import type { CountingClientStorage } from './memory-storage';

type Pending = { readonly id: string; readonly by: Change };
export type RecoveryModel = {
  pending: Pending[];
  server: Change[];
  local: Change[];
  synced: boolean;
  lastAck: { entry: LogEntry; id: string } | null;
};
export type RecoveryReal = {
  rig: ClientRig;
  storage: CountingClientStorage;
};
type Command = AsyncCommand<RecoveryModel, RecoveryReal>;

export async function assertRecoveryState(
  model: Readonly<RecoveryModel>,
  real: RecoveryReal
): Promise<void> {
  await real.rig.room.flushIo();
  const ids = model.pending.map((p) => p.id);
  const total = [...model.local, ...model.pending.map((p) => p.by)].reduce(
    (sum, by) => sum + by,
    0
  );
  expect(real.rig.room.getPendingQueueIds()).toEqual(ids);
  expect(real.storage.queue.map((q) => q.id)).toEqual(ids);
  expect(readTally(real.rig.room.getSnapshot())).toBe(total);
  expect(real.rig.room.getLastSeq()).toBe(model.local.length);
}

export function reopenCachedClient(): Command {
  return {
    check: () => true,
    toString: () => 'reopen cached client',
    async run(model, real) {
      await real.rig.room.flushIo();
      real.rig.room.destroy();
      real.rig = await openClient(real.storage);
      model.synced = false;
      await assertRecoveryState(model, real);
    },
  };
}

export function receiveHistory(): Command {
  return {
    check: (model) => !model.synced,
    toString: () => 'receive authoritative history',
    async run(model, real) {
      real.rig.transport.connect();
      real.rig.transport.deliver(
        welcome(model.server.map((by, i) => tallyEntry(i + 1, 'bob', by)))
      );
      model.local = [...model.server];
      model.synced = true;
      await assertRecoveryState(model, real);
    },
  };
}

export function acknowledgePending(): Command {
  return {
    check: (model) => model.synced && model.pending.length > 0,
    toString: () => 'acknowledge one original command',
    async run(model, real) {
      const pending = model.pending.shift()!;
      const entry = tallyEntry(model.server.length + 1, 'alice', pending.by);
      real.rig.transport.deliver(committed([entry], pending.id));
      model.server.push(pending.by);
      model.local.push(pending.by);
      model.lastAck = { entry, id: pending.id };
      await assertRecoveryState(model, real);
    },
  };
}

export function repeatAcknowledgment(): Command {
  return {
    check: (model) => model.synced && model.lastAck !== null,
    toString: () => 'repeat an acknowledged frame',
    async run(model, real) {
      const ack = model.lastAck!;
      real.rig.transport.deliver(committed([ack.entry], ack.id));
      await assertRecoveryState(model, real);
    },
  };
}

export function receiveOtherChange(by: Change): Command {
  return {
    check: (model) => model.synced,
    toString: () => `receive another actor's change ${by}`,
    async run(model, real) {
      const entry = tallyEntry(model.server.length + 1, 'bob', by);
      real.rig.transport.deliver(committed([entry]));
      model.server.push(by);
      model.local.push(by);
      await assertRecoveryState(model, real);
    },
  };
}
