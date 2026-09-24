import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { asKeyword, type LogEntry, ROOM_ERROR_TYPE } from '@pkgs/room';
import type { CommandDedupOutcome } from '@pkgs/room/server';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory';

const EVENT_TYPE = asKeyword('test/event');

function entry(seq: number): LogEntry {
  return { seq, event: { type: EVENT_TYPE, payload: seq } };
}

/** Reference model: per-topic append-only log + dedup map; absent topic = never touched. */
type Model = Map<
  string,
  { entries: LogEntry[]; dedup: Map<string, CommandDedupOutcome> }
>;
type Real = InMemoryRoomStorage;
type Cmd = fc.AsyncCommand<Model, Real>;

const lastSeqOf = (m: Model, topic: string): number =>
  m.get(topic)?.entries.at(-1)?.seq ?? 0;

function touch(m: Model, topic: string) {
  let t = m.get(topic);
  if (t === undefined) {
    t = { entries: [], dedup: new Map() };
    m.set(topic, t);
  }
  return t;
}

async function expectAgrees(m: Model, r: Real, topic: string): Promise<void> {
  expect(await r.getLastSeq(topic)).toBe(lastSeqOf(m, topic));
  expect([...r.listTopics()].sort()).toEqual([...m.keys()].sort());
  const t = m.get(topic);
  const snap = r.snapshotTopic(topic);
  if (t === undefined) {
    expect(snap).toBeNull();
    return;
  }
  expect(snap).toEqual({
    lastSeq: lastSeqOf(m, topic),
    entries: t.entries,
    dedupSize: t.dedup.size,
  });
}

const arbTopic = fc.constantFrom('t1', 't2', 't3');
const arbCommandId = fc.constantFrom('c1', 'c2', 'c3');
const arbOutcome: fc.Arbitrary<CommandDedupOutcome> = fc.oneof(
  fc.nat({ max: 3 }).map(
    (n): CommandDedupOutcome => ({
      kind: 'committed',
      entries: [entry(n + 1)],
    })
  ),
  fc.constant<CommandDedupOutcome>({
    kind: 'rejected',
    error: { type: ROOM_ERROR_TYPE.conflict, reason: 'x' },
  })
);

function append(topic: string, count: number, skew: number): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const start = lastSeqOf(m, topic) + 1 + skew;
      const batch = Array.from({ length: count }, (_, i) => entry(start + i));
      const outcome = await r.appendCommittedEntries(topic, batch).then(
        () => 'ok',
        () => 'rejected'
      );
      if (count === 0) {
        expect(outcome).toBe('ok');
      } else if (skew !== 0) {
        expect(outcome).toBe('rejected');
        // A rejected append still registers the topic but writes nothing.
        touch(m, topic);
      } else {
        expect(outcome).toBe('ok');
        touch(m, topic).entries.push(...batch);
      }
      // Callers may reuse their batch array; storage must not alias it.
      batch.length = 0;
      await expectAgrees(m, r, topic);
    },
    toString: (): string => `append(${topic},${count},${skew})`,
  };
}

function loadAfter(topic: string, after: number): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const got = await r.loadEventsAfter(topic, after);
      const t = touch(m, topic);
      expect(got).toEqual(t.entries.filter((e) => e.seq > after));
      got.length = 0;
      await expectAgrees(m, r, topic);
    },
    toString: (): string => `loadAfter(${topic},${after})`,
  };
}

function putDedup(
  topic: string,
  id: string,
  outcome: CommandDedupOutcome
): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      await r.putDedupOutcome(topic, id, outcome);
      touch(m, topic).dedup.set(id, outcome);
      await expectAgrees(m, r, topic);
    },
    toString: (): string => `putDedup(${topic},${id})`,
  };
}

function getDedup(topic: string, id: string): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const want = m.get(topic)?.dedup.get(id) ?? null;
      expect(await r.getDedupOutcome(topic, id)).toEqual(want);
      await expectAgrees(m, r, topic);
    },
    toString: (): string => `getDedup(${topic},${id})`,
  };
}

function clear(topic: string): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      r.clearTopic(topic);
      m.delete(topic);
      await expectAgrees(m, r, topic);
    },
    toString: (): string => `clear(${topic})`,
  };
}

/** export(from) → replace(to): the target becomes an independent copy of the source. */
function copyTopic(from: string, to: string): Cmd {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const exported = r.exportTopic(from);
      const src = m.get(from);
      if (src === undefined) {
        expect(exported).toBeNull();
        return;
      }
      expect(exported?.dedup).toEqual(Object.fromEntries(src.dedup));
      r.replaceTopic(to, {
        entries: exported!.entries,
        dedup: exported!.dedup!,
      });
      m.set(to, { entries: [...src.entries], dedup: new Map(src.dedup) });
      await expectAgrees(m, r, from);
      await expectAgrees(m, r, to);
    },
    toString: (): string => `copy(${from}→${to})`,
  };
}

const arbCommand: fc.Arbitrary<Cmd> = fc.oneof(
  {
    arbitrary: fc
      .tuple(
        arbTopic,
        fc.nat({ max: 3 }),
        fc.oneof(
          { arbitrary: fc.constant(0), weight: 3 },
          { arbitrary: fc.integer({ min: -2, max: 2 }), weight: 1 }
        )
      )
      .map(([t, c, s]): Cmd => append(t, c, s)),
    weight: 4,
  },
  {
    arbitrary: fc
      .tuple(arbTopic, fc.integer({ min: -1, max: 8 }))
      .map(([t, a]): Cmd => loadAfter(t, a)),
    weight: 2,
  },
  {
    arbitrary: fc
      .tuple(arbTopic, arbCommandId, arbOutcome)
      .map(([t, id, o]): Cmd => putDedup(t, id, o)),
    weight: 2,
  },
  {
    arbitrary: fc
      .tuple(arbTopic, arbCommandId)
      .map(([t, id]): Cmd => getDedup(t, id)),
    weight: 2,
  },
  { arbitrary: arbTopic.map((t): Cmd => clear(t)), weight: 1 },
  {
    arbitrary: fc
      .tuple(arbTopic, arbTopic)
      .map(([a, b]): Cmd => copyTopic(a, b)),
    weight: 1,
  }
);

describe('InMemoryRoomStorage model', () => {
  test('log, dedup and topic lifecycle agree with the reference model', async () => {
    await assertProperty(
      'room storage model',
      fc.asyncProperty(
        fc.commands([arbCommand], { maxCommands: 30, size: 'large' }),
        async (cmds) => {
          await fc.asyncModelRun(
            () => ({
              model: new Map() satisfies Model,
              real: new InMemoryRoomStorage(),
            }),
            cmds
          );
        }
      )
    );
  });
});
