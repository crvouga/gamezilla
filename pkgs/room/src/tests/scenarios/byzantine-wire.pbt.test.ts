import { describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/dst';
import { assertProperty, fc } from '@pkgs/pbt';
import {
  arbRoomKnobs,
  arbSeed,
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
  clientHash,
  clock,
  converge,
  playRoomActions,
  type RoomSurface,
  type RoomSystemAction,
  replayRoom,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { counterValue } from '../fixtures/counter-module';
import { readServer } from '../scenario/read-state';

function injectAction(
  kind: ByzantineInjectKind,
  now: number
): RoomSystemAction {
  const raw = buildByzantineRaw(kind, now);
  if (raw.direction === 'toServer') {
    return {
      kind: 'injectToServer',
      clientId: 'c1',
      raw: raw.raw,
      direct: true,
    };
  }
  return { kind: 'injectFromServer', clientId: 'c1', raw: raw.raw };
}

async function expectServerTruthRestored(
  run: Run<RoomSurface>,
  before: string
): Promise<void> {
  const after = await run.observe(serverHash);
  expect(after).not.toBe(before);
  expect(counterValue(await readServer(run))).toBe(1);
  const hashes = (await run.observe(clientHash)) as Record<string, string>;
  expect(hashes['c0']).toBe(after);
  expect(hashes['c1']).toBe(after);
}

describe('room byzantine-wire PBT', () => {
  test(
    'each inject catalog arm then settle restores server truth',
    async () => {
      await assertProperty(
        'byzantine inject converges to server',
        fc.asyncProperty(
          arbSeed(),
          arbRoomKnobs(),
          fc.constantFrom(...BYZANTINE_INJECT_KINDS),
          async (seed, knobs, kind) => {
            await using run = await replayRoom(counterSystem, {
              seed,
              knobs: { ...knobs, clientCount: 2 },
              converge: false,
              actions: [],
            });
            const before = await run.observe(serverHash);
            await playRoomActions(run, [
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'increment',
                args: {},
              },
              { kind: 'idle', ms: 20 },
            ]);
            await playRoomActions(run, [
              injectAction(kind, await run.observe(clock)),
              { kind: 'idle', ms: 10 },
            ]);
            await run.apply(converge);
            await expectServerTruthRestored(run, before);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
