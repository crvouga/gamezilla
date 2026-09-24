/**
 * Model-based property for rebasing pending mutations over server snapshots.
 *
 * Model: a note table keyed by id → { body, owner, live }. `setNote` upserts
 * (revives, takes ownership); `deleteNote` tombstones a live note the actor
 * owns, is a no-op on a missing / dead note, and is refused (FORBIDDEN) on a
 * note someone else owns.
 *
 * Walk: from any converged state (the previous case's end — one long-lived
 * sim over a fixed set of note ids), both clients write a random base and
 * converge; alice goes offline and queues random writes while bob keeps
 * writing online. Properties:
 *   1. alice's local view = base snapshot + her accepted pending, in order;
 *   2. the server = base + bob's writes (alice's queue has not landed);
 *   3. after reconnect every node = base + bob + alice's queue replayed in
 *      seq order against server truth (refused replays leave no trace).
 */
import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import type { Run } from '@pkgs/sim';
import { sql } from '@pkgs/sql';
import {
  addClient,
  connect,
  deleteNote,
  disconnect,
  exampleSystem,
  expectInSync,
  lastMutationOk,
  mutate,
  rows,
  type SyncSim,
  setNote,
  untilExample,
} from '@pkgs/sync-engine/sim';

type Actor = 'alice' | 'bob';
type Op =
  | {
      readonly kind: 'set';
      readonly by: Actor;
      readonly k: number;
      readonly body: string;
    }
  | { readonly kind: 'del'; readonly by: Actor; readonly k: number };
type ModelNote = {
  readonly body: string;
  readonly owner: Actor;
  readonly live: boolean;
};
type Model = Readonly<Record<string, ModelNote>>;

const NOTE_SLOTS = 3;

const arbOp = (by: fc.Arbitrary<Actor>): fc.Arbitrary<Op> =>
  fc.oneof(
    fc.record({
      kind: fc.constant('set' as const),
      by,
      k: fc.nat({ max: NOTE_SLOTS - 1 }),
      body: fc.constantFrom('x', 'y', 'z'),
    }),
    fc.record({
      kind: fc.constant('del' as const),
      by,
      k: fc.nat({ max: NOTE_SLOTS - 1 }),
    })
  );

const arbWalk = fc.record({
  base: fc.array(arbOp(fc.constantFrom<Actor>('alice', 'bob')), {
    maxLength: 3,
  }),
  alice: fc.array(arbOp(fc.constant<Actor>('alice')), { maxLength: 5 }),
  bob: fc.array(arbOp(fc.constant<Actor>('bob')), { maxLength: 3 }),
});

/** Model transition; `ok: false` means the mutation is refused (FORBIDDEN). */
function step(model: Model, id: string, op: Op): { model: Model; ok: boolean } {
  const cur = model[id];
  if (op.kind === 'set') {
    return {
      model: { ...model, [id]: { body: op.body, owner: op.by, live: true } },
      ok: true,
    };
  }
  if (cur === undefined || !cur.live) return { model, ok: true };
  if (cur.owner !== op.by) return { model, ok: false };
  return { model: { ...model, [id]: { ...cur, live: false } }, ok: true };
}

const noteId = (op: Op): string => `n${String(op.k)}`;

/**
 * One sim for every case: the runner disposes open sims after each test, so
 * it is opened in the test body.
 */
let sim: Run<SyncSim>;

async function readNotes(
  s: SyncSim,
  node: string
): Promise<Record<string, ModelNote>> {
  const found = (await rows(
    s,
    'pendingRebaseNotes',
    node,
    sql`SELECT id, body, owner_id, deleted_at FROM notes`
  )) as {
    id: string;
    body: string;
    owner_id: Actor;
    deleted_at: string | null;
  }[];
  const out: Record<string, ModelNote> = {};
  for (const r of found) {
    out[r.id] = {
      body: r.body,
      owner: r.owner_id,
      live: r.deleted_at === null,
    };
  }
  return out;
}

async function apply(op: Op): Promise<boolean> {
  const id = noteId(op);
  if (op.kind === 'set') {
    await sim.apply(mutate, op.by, setNote, { id, body: op.body });
  } else {
    await sim.apply(mutate, op.by, deleteNote, { id });
  }
  return sim.read(lastMutationOk, op.by);
}

/** Apply `ops` on the sim, asserting each accept/refuse matches the model. */
async function applyAll(
  model: Model,
  ops: readonly Op[],
  afterEach?: () => Promise<void>
): Promise<{ model: Model; accepted: Op[] }> {
  let m = model;
  const accepted: Op[] = [];
  for (const op of ops) {
    const r = step(m, noteId(op), op);
    expect(await apply(op)).toBe(r.ok);
    m = r.model;
    if (r.ok) accepted.push(op);
    if (afterEach !== undefined) await afterEach();
  }
  return { model: m, accepted };
}

/** Server replay: every queued op re-decided against server truth. */
function replay(model: Model, ops: readonly Op[]): Model {
  let m = model;
  for (const op of ops) m = step(m, noteId(op), op).model;
  return m;
}

async function pendingRebaseCase(walk: {
  readonly base: readonly Op[];
  readonly alice: readonly Op[];
  readonly bob: readonly Op[];
}): Promise<void> {
  await expectInSync(sim);
  const start = await sim.read(readNotes, 'server');
  const { model: base } = await applyAll(start, walk.base, () =>
    expectInSync(sim)
  );

  await sim.apply(disconnect, 'alice');
  const alice = await applyAll(base, walk.alice);
  const bob = await applyAll(base, walk.bob);

  // (1) optimistic view: base snapshot + alice's accepted pending.
  expect(await sim.read(readNotes, 'alice')).toEqual(alice.model);
  // (2) server: base + bob only (alice is offline).
  const serverBeforeAlice = await untilExample(
    sim,
    (s) => readNotes(s, 'server'),
    { pred: (v) => Bun.deepEquals(v, bob.model) }
  );
  expect(serverBeforeAlice).toEqual(bob.model);

  // (3) reconnect: server replays alice's queue over its own truth.
  await sim.apply(connect, 'alice');
  await expectInSync(sim);
  const converged = replay(bob.model, alice.accepted);
  for (const node of ['server', 'alice', 'bob']) {
    expect(await sim.read(readNotes, node)).toEqual(converged);
  }
}

describe('pending rebase over server snapshots (model-based)', () => {
  test('local = snapshot + pending; converged = server replay of pending in seq order', async () => {
    await using opened = await exampleSystem.run({
      seed: 7101,
      args: { clientCount: 0 },
    });
    sim = opened;
    await sim.apply(addClient, 'alice');
    await sim.apply(addClient, 'bob');
    await assertProperty(
      'pending rebase model',
      fc.asyncProperty(arbWalk, pendingRebaseCase)
    );
    // ~1.2 s idle: 40 walks through one live sim. Bun's 5 s default is a
    // wall-clock verdict on a loaded runner; the task budget still bounds it.
  }, 30_000);
});
