import fc from 'fast-check';

import { bootClients } from '../../sim/replay-steps';
import { openSimWorld } from '../../sim/world';
import type { SimWorld } from '../../sim/world-api';
import type { DstApp } from './app';

export type WorldKnobs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
};

export type OpenPbtWorldResult = {
  readonly world: SimWorld;
  readonly clientIds: readonly string[];
  readonly knobs: WorldKnobs;
  readonly app: DstApp;
};

export const arbWorldSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export const arbWorldKnobs = (): fc.Arbitrary<WorldKnobs> =>
  fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });

export async function openPbtWorld(args: {
  readonly app: DstApp;
  readonly seed: number;
  readonly knobs: WorldKnobs;
}): Promise<OpenPbtWorldResult> {
  const world = await openSimWorld({
    seed: args.seed,
    domain: args.app.pack,
    rowImageFanout: args.knobs.rowImageFanout,
    liveResendOnReconnect: args.knobs.liveResendOnReconnect,
    bufferOutboundLive: args.knobs.bufferOutboundLive,
  });
  const clientIds = await bootClients({
    world,
    clientCount: args.knobs.clientCount,
    sampleFaults: false,
  });
  return { world, clientIds, knobs: args.knobs, app: args.app };
}

export async function runActionWithInvariants(
  world: SimWorld,
  run: () => Promise<void>
): Promise<void> {
  await run();
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
}
