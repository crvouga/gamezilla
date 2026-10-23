import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import type { QueuedCommand } from '@pkgs/room-root-shared-ts/core-storage';
import type { LogEntry } from '@pkgs/room-root-shared-ts/types';
import fc from 'fast-check';

const TYPE = asKeyword('test/cmd');

/** Reference model: committed log is append-only until reset; queue is a replaced snapshot. */
type Model = { entries: LogEntry[]; queue: QueuedCommand[] };
type Real = InMemoryClientStorage;
type Cmd = fc.AsyncCommand<Model, Real>;

async function expectAgrees(m: Model, r: Real): Promise<void> {
  const committed = await r.loadCommitted();
  const lastSeq = m.entries.length === 0 ? 0 : m.entries.at(-1)!.seq;
  expect(committed).toEqual({ lastSeq, entries: m.entries });
  expect(await r.loadQueued()).toEqual(m.queue);
  // Loaded arrays are snapshots: mutating them must not reach storage.
  committed.entries.length = 0;
  (await r.loadQueued()).length = 0;
}

function append(count: number): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const base = m.entries.length === 0 ? 0 : m.entries.at(-1)!.seq;
      const entries: LogEntry[] = [];
      for (let i = 1; i <= count; i++) {
        entries.push({
          seq: base + i,
          event: { type: TYPE, payload: base + i },
        });
      }
      await r.appendCommitted(entries);
      m.entries = [...m.entries, ...entries];
      entries.length = 0;
      await expectAgrees(m, r);
    },
    toString: (): string => `append(${count})`,
  };
}

function reset(): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      await r.resetCommitted();
      m.entries = [];
      await expectAgrees(m, r);
    },
    toString: (): string => 'reset()',
  };
}

function saveQueue(ids: string[], ts: number): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const queue: QueuedCommand[] = ids.map((id, i) => ({
        id,
        ts: ts + i,
        payload: { type: TYPE, payload: ts + i },
      }));
      await r.saveQueued(queue);
      m.queue = [...queue];
      queue.length = 0;
      await expectAgrees(m, r);
    },
    toString: (): string => `saveQueue([${ids}],${ts})`,
  };
}

const arbId = fc.constantFrom('q1', 'q2', 'q3');
const arbCommand: fc.Arbitrary<Cmd> = fc.oneof(
  fc.nat({ max: 4 }).map((n): Cmd => append(n)),
  fc.constant(reset()),
  fc
    .tuple(fc.uniqueArray(arbId, { maxLength: 3 }), fc.nat({ max: 1000 }))
    .map(([ids, ts]): Cmd => saveQueue(ids, ts))
);

describe('InMemoryClientStorage model', () => {
  test('committed log and outbound queue agree with the reference model', async () => {
    await assertProperty(
      'client storage model',
      fc.asyncProperty(
        fc.commands([arbCommand], { maxCommands: 25, size: 'large' }),
        async (cmds) => {
          await fc.asyncModelRun(
            () => ({
              model: { entries: [], queue: [] },
              real: new InMemoryClientStorage(),
            }),
            cmds
          );
        }
      )
    );
  });
});
