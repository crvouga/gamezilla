import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import {
  advancePeer,
  assertClientAlignedWithServer,
  assertServerHasLiveColumns,
  closeWorld,
  forbiddenSchema,
  openWorld,
  planKindHash,
  reconcilePeer,
  type SchemaVersion,
  type SchemaWorld,
  schemaAt,
} from './world';

type AdvanceCmd = {
  readonly kind: 'advance';
  readonly target: 'server' | number;
  readonly to: SchemaVersion;
};

type ForbiddenCmd = { readonly kind: 'forbidden' };

type WorldCmd = AdvanceCmd | ForbiddenCmd;

function cmdArb(clientCount: number): fc.Arbitrary<WorldCmd> {
  const peerArb = fc.oneof(
    fc.constant<'server'>('server'),
    fc.integer({ min: 0, max: Math.max(0, clientCount - 1) })
  );
  return fc.oneof(
    fc.record({
      kind: fc.constant<'advance'>('advance'),
      target: peerArb,
      to: fc.integer({ min: 0, max: 4 }) as fc.Arbitrary<SchemaVersion>,
    }),
    fc.constant<ForbiddenCmd>({ kind: 'forbidden' })
  );
}

async function applyAdvance(
  world: SchemaWorld,
  cmd: AdvanceCmd
): Promise<void> {
  const peer =
    cmd.target === 'server'
      ? world.server
      : world.clients[cmd.target % world.clients.length]!;
  const to = Math.max(peer.version, cmd.to) as SchemaVersion;
  const capped =
    peer.kind === 'client'
      ? (Math.min(to, world.server.version) as SchemaVersion)
      : to;
  if (capped > peer.version) {
    await advancePeer(peer, capped);
  }
}

async function applyForbidden(world: SchemaWorld): Promise<void> {
  const before = planKindHash(world.server);
  let refused = false;
  try {
    await reconcilePeer(world.server, forbiddenSchema());
  } catch {
    refused = true;
  }
  expect(refused).toBe(true);
  expect(planKindHash(world.server)).toBe(before);
}

async function runWorldCmds(
  world: SchemaWorld,
  cmds: readonly WorldCmd[]
): Promise<void> {
  for (const cmd of cmds) {
    if (cmd.kind === 'advance') {
      await applyAdvance(world, cmd);
    } else {
      await applyForbidden(world);
    }
    await assertServerHasLiveColumns(world);
  }
  for (const c of world.clients) {
    await assertClientAlignedWithServer(c, world.server);
  }
  expect(planKindHash(world.server).length).toBe(64);
}

describe('db-schema DST world', () => {
  test('compatible schema chain + mixed clients + forbidden refuse', async () => {
    await assertDstProperty(
      'schema world',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.integer({ min: 1, max: 3 }),
        fc.array(cmdArb(3), { minLength: 3, maxLength: 10 }),
        async (seed, clientCount, cmds) => {
          const world = await openWorld({ seed, clientCount });
          try {
            await runWorldCmds(world, cmds);
          } finally {
            await closeWorld(world);
          }
        }
      ),
      { numRuns: 6 }
    );
  });

  test('scripted: server ahead of lagging client stays valid', async () => {
    const world = await openWorld({ seed: 42, clientCount: 2 });
    try {
      await advancePeer(world.server, 2);
      await advancePeer(world.clients[0]!, 1);
      await advancePeer(world.clients[1]!, 2);
      await assertServerHasLiveColumns(world);
      await assertClientAlignedWithServer(world.clients[1]!, world.server);
      await advancePeer(world.clients[0]!, 2);
      expect(world.clients[0]!.version).toBe(2);
      await reconcilePeer(world.server, schemaAt(2));
    } finally {
      await closeWorld(world);
    }
  });

  test('surface coverage: schema snapshot exports checks/views/enums arrays', () => {
    const snap = schemaAt(4).snapshot();
    expect(Array.isArray(snap.checks)).toBe(true);
    expect(Array.isArray(snap.views)).toBe(true);
    expect(Array.isArray(snap.enums)).toBe(true);
    expect(Object.keys(snap.tables['items']!).includes('score')).toBe(true);
  });
});
