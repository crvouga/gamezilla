import { describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import { assertProperty, fc } from '@pkgs/pbt';
import {
  arbRoomArgs,
  arbSeed,
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
  clientHash,
  clock,
  domain,
  injectFromServer,
  injectToServer,
  type RoomSurface,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue } from '../fixtures/counter-module';
import { openRoom } from '../scenario/open-room';
import { readServer } from '../scenario/read-state';

async function injectByzantine(
  s: Script<RoomSurface>,
  kind: ByzantineInjectKind,
  now: number
): Promise<void> {
  const raw = buildByzantineRaw(kind, now);
  if (raw.direction === 'toServer') {
    await s.apply(injectToServer, {
      clientId: 'c1',
      raw: raw.raw,
      direct: true,
    });
    return;
  }
  await s.apply(injectFromServer, {
    clientId: 'c1',
    raw: raw.raw,
  });
}

async function expectServerTruthRestored(
  s: Script<RoomSurface>,
  before: string
): Promise<void> {
  const after = await s.observe(serverHash);
  expect(after).not.toBe(before);
  expect(counterValue(await readServer(s))).toBe(1);
  const hashes = (await s.observe(clientHash)) as Record<string, string>;
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
          arbRoomArgs(),
          fc.constantFrom(...BYZANTINE_INJECT_KINDS),
          async (seed, knobs, kind) => {
            await using s = await openRoom(counterSystem, {
              seed,
              clientCount: 2,
              mildFaults: knobs.mildFaults === true,
            });
            const before = await s.observe(serverHash);
            await s.apply(domain, {
              kind: 'domain',
              clientId: 'c0',
              command: 'increment',
              args: {},
            });
            await s.elapse(20);
            await injectByzantine(run, kind, await s.observe(clock));
            await s.elapse(10);
            await expectConverged(s);
            await expectServerTruthRestored(run, before);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
