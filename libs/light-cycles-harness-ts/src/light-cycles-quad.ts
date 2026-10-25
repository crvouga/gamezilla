import { simulationRoomCourt } from '@libs/game-session-harness-ts/simulation-room-fixture';
import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesQuadShared } from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';

/** Quad riders, each on their own device, in seat order. */
export const LIGHT_CYCLES_RIDERS = {
  white: 'alice',
  black: 'bob',
  red: 'carol',
  blue: 'dave',
} as const satisfies Record<LightCyclesSeat, string>;
export type LightCyclesRiderId =
  (typeof LIGHT_CYCLES_RIDERS)[keyof typeof LIGHT_CYCLES_RIDERS];

export const LIGHT_CYCLES_QUAD_CODEC = lightCyclesPositionCodec(4);
export const LIGHT_CYCLES_QUAD_SIMULATION =
  lightCyclesQuadShared.registration.simulation!;
export const LIGHT_CYCLES_TIMING = LIGHT_CYCLES_QUAD_SIMULATION.timing;

export function seatOf(id: string): LightCyclesSeat | null {
  const entry = Object.entries(LIGHT_CYCLES_RIDERS).find(
    ([, person]) => person === id
  );
  return entry === undefined ? null : (entry[0] as LightCyclesSeat);
}

export function decodeArena(position: string): LightCyclesState | null {
  return LIGHT_CYCLES_QUAD_CODEC.decode(position);
}

/** Round 1 already riding, so the first tick meets moving riders. */
export function ridingQuadPosition(targetScore = 3): string {
  return LIGHT_CYCLES_QUAD_CODEC.encode({
    ...lightCyclesStart(4, targetScore),
    phase: 'running',
  });
}

/** The input generation a device's room says is current, as its replica checks it. */
export function deviceGeneration(
  kit: RoomHarnessRuntime,
  id: string
): string | null {
  const room = kit.clients.get(id)?.room();
  const execution =
    room === null || room === undefined
      ? undefined
      : simulationRoomCourt(room.getSnapshot())?.execution;
  return execution === undefined
    ? null
    : `${execution.epoch}:${execution.inputGeneration}`;
}
