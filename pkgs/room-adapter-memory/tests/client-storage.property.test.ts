import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { asKeyword, type LogEntry, type QueuedCommand } from '@pkgs/room';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory';

const TYPE = asKeyword('test/cmd');

/** Reference model: committed tail is last-write-wins; queue is an ordered list. */
type Model = { lastSeq: number; entries: LogEntry[]; queue: QueuedCommand[] };
type Real = InMemoryClientStorage;
type Cmd = fc.AsyncCommand<Model, Real>;

async function expectAgrees(m: Model, r: Real): Promise<void> {
  const committed = await r.loadCommitted();
  expect(committed).toEqual({ lastSeq: m.lastSeq, entries: m.entries });
  expect(await r.loadQueued()).toEqual(m.queue);
  // Loaded arrays are snapshots: mutating them must not reach storage.
  committed.entries.length = 0;
  (await r.loadQueued()).length = 0;
}

function saveCommitted(lastSeq: number, seqs: number[]): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const entries = seqs.map(
        (seq): LogEntry => ({ seq, event: { type: TYPE, payload: seq } })
      );
      await r.saveCommitted(lastSeq, entries);
      m.lastSeq = lastSeq;
      m.entries = [...entries];
      entries.length = 0;
      await expectAgrees(m, r);
    },
    toString: (): string => `save(${lastSeq},[${seqs}])`,
  };
}

function append(id: string, ts: number): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const cmd: QueuedCommand = {
        id,
        ts,
        payload: { type: TYPE, payload: ts },
      };
      await r.appendQueued(cmd);
      m.queue.push(cmd);
      await expectAgrees(m, r);
    },
    toString: (): string => `append(${id},${ts})`,
  };
}

function remove(id: string): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      await r.removeQueued(id);
      m.queue = m.queue.filter((c) => c.id !== id);
      await expectAgrees(m, r);
    },
    toString: (): string => `remove(${id})`,
  };
}

const arbId = fc.constantFrom('q1', 'q2', 'q3');
const arbCommand: fc.Arbitrary<Cmd> = fc.oneof(
  fc
    .tuple(fc.nat({ max: 20 }), fc.array(fc.nat({ max: 20 }), { maxLength: 4 }))
    .map(([s, xs]): Cmd => saveCommitted(s, xs)),
  fc.tuple(arbId, fc.nat({ max: 1000 })).map(([id, ts]): Cmd => append(id, ts)),
  arbId.map((id): Cmd => remove(id))
);

describe('InMemoryClientStorage model', () => {
  test('committed tail and outbound queue agree with the reference model', async () => {
    await assertProperty(
      'client storage model',
      fc.asyncProperty(
        fc.commands([arbCommand], { maxCommands: 25, size: 'large' }),
        async (cmds) => {
          await fc.asyncModelRun(
            () => ({
              model: { lastSeq: 0, entries: [], queue: [] },
              real: new InMemoryClientStorage(),
            }),
            cmds
          );
        }
      )
    );
  });
});
