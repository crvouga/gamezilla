import { describe, expect, test } from 'bun:test';
import {
  AddOne,
  ClaimRoom,
  gameRoomModule,
  Move,
  StartMatch,
  TakeOne,
  TurnAway,
} from '@pkgs/room-root-harness-ts/game-room';
import { runModuleConformance } from '@pkgs/room-root-harness-ts/module-conformance';

describe('kit: purity and seed (M-F01)', () => {
  test('the example game room passes the conformance suite', async () => {
    await runModuleConformance({
      seed: process.env['HARNESS_SEED'] ?? '42',
      module: gameRoomModule,
      mildFaults: false,
      isValidState: () => true,
      generateCommand: ({ rng }) =>
        rng.pick([
          AddOne({}),
          TakeOne({}),
          ClaimRoom({}),
          TurnAway({ person: 'eve' }),
          StartMatch({ whiteMs: 5_000, blackMs: 5_000 }),
          Move({}),
        ]),
    });
    expect(true).toBe(true);
  });
});
