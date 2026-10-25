import type { LightCyclesState } from './light-cycles-state';

/**
 * Eliminates an absent rider during countdown or play. Its trail stays and the
 * round's end is decided at the next movement step. Idempotent: any other
 * phase, seat or an already eliminated rider leaves the state unchanged.
 */
export function retireLightCyclesRider(
  state: LightCyclesState,
  seat: string
): LightCyclesState {
  if (state.phase !== 'countdown' && state.phase !== 'running') return state;
  const index = state.riders.findIndex((rider) => rider.seat === seat);
  const rider = state.riders[index];
  if (rider === undefined || !rider.alive) return state;
  return {
    ...state,
    riders: state.riders.with(index, { ...rider, alive: false, turns: [] }),
    crashes: [
      ...state.crashes,
      { seat: rider.seat, x: rider.x, y: rider.y, cause: 'retired' },
    ],
  };
}
