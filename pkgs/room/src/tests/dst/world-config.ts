import fc from 'fast-check';

import { openRoomSimWorld } from '../../sim/world';
import type { RoomSimWorld } from '../../sim/world-api';
import type { RoomDstApp } from './app';

export type WorldKnobs = {
  readonly clientCount: number;
  readonly mildFaults: boolean;
};

export type OpenPbtWorldResult = {
  readonly world: RoomSimWorld;
  readonly clientIds: readonly string[];
  readonly knobs: WorldKnobs;
  readonly app: RoomDstApp;
};

export const arbWorldSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export const arbWorldKnobs = (): fc.Arbitrary<WorldKnobs> =>
  fc.record({
    clientCount: fc.integer({ min: 2, max: 3 }),
    mildFaults: fc.boolean(),
  });

export async function openPbtWorld(args: {
  readonly app: RoomDstApp;
  readonly seed: number;
  readonly knobs: WorldKnobs;
}): Promise<OpenPbtWorldResult> {
  const world = await openRoomSimWorld({
    seed: args.seed,
    module: args.app.module,
    mildFaults: args.knobs.mildFaults,
    ...(args.app.authorize !== undefined
      ? { authorize: args.app.authorize }
      : {}),
  });
  const clientIds: string[] = [];
  for (let i = 0; i < args.knobs.clientCount; i += 1) {
    const id = `c${i}`;
    await world.addClient({ id, identity: id, clientId: id });
    clientIds.push(id);
  }
  return { world, clientIds, knobs: args.knobs, app: args.app };
}
