import {
  LIGHT_CYCLES_RIDERS,
  type LightCyclesSeat,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  type LightCyclesState,
  plannedHeading,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { t } from '@lingui/core/macro';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type {
  TrailCrash,
  TrailHeading,
  TrailOverlay,
  TrailRider,
  TrailRiderIndex,
} from '@pkgs/ui-root-client-ts/trail-arena';

const config = lightCyclesConfig();

/** Why this device can or cannot steer its rider right now; a test and screen-reader hook. */
export type LightCyclesSteering =
  | 'watching'
  | 'elsewhere'
  | 'away'
  | 'finished'
  | 'round-over'
  | 'crashed'
  | 'countdown'
  | 'riding';

export function riderName(seat: GameSide): string {
  return LIGHT_CYCLES_RIDERS[seat as LightCyclesSeat].name;
}

export function trailRiders(
  state: LightCyclesState,
  controlled: readonly GameSide[]
): readonly TrailRider[] {
  return state.riders.map((rider, index) => ({
    index: index as TrailRiderIndex,
    x: rider.x,
    y: rider.y,
    heading: rider.heading,
    next: plannedHeading(rider),
    alive: rider.alive,
    mark: LIGHT_CYCLES_RIDERS[rider.seat].mark,
    controlled: controlled.includes(rider.seat),
    label: LIGHT_CYCLES_RIDERS[rider.seat].name,
  }));
}

export function trailCrashes(state: LightCyclesState): readonly TrailCrash[] {
  return state.crashes.map((crash) => ({
    index: state.seats.indexOf(crash.seat) as TrailRiderIndex,
    x: crash.x,
    y: crash.y,
  }));
}

function directionText(heading: TrailHeading): string {
  return { up: t`up`, right: t`right`, down: t`down`, left: t`left` }[heading];
}

const STEP: Readonly<Record<TrailHeading, readonly [number, number]>> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};
const LEFT_OF: Readonly<Record<TrailHeading, TrailHeading>> = {
  up: 'left',
  right: 'up',
  down: 'right',
  left: 'down',
};
const RIGHT_OF: Readonly<Record<TrailHeading, TrailHeading>> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};

/** Free cells before the first wall or trail, stepping from a head toward `heading`. */
export function clearCells(
  state: LightCyclesState,
  x: number,
  y: number,
  heading: TrailHeading
): number {
  const [dx, dy] = STEP[heading];
  let count = 0;
  for (
    let cx = x + dx, cy = y + dy;
    cx >= 0 &&
    cy >= 0 &&
    cx < state.width &&
    cy < state.height &&
    state.trails.charAt(cy * state.width + cx) === '.';
    cx += dx, cy += dy
  )
    count++;
  return count;
}

/**
 * The room a steered rider has, for a listener: the free cells straight
 * ahead, to its left and to its right before a wall or a trail, which a
 * sighted player reads from the drawing.
 */
function roomText(
  state: LightCyclesState,
  x: number,
  y: number,
  heading: TrailHeading
) {
  const ahead = clearCells(state, x, y, heading);
  const left = clearCells(state, x, y, LEFT_OF[heading]);
  const right = clearCells(state, x, y, RIGHT_OF[heading]);
  return t`Free cells: ${ahead} ahead, ${left} to the left, ${right} to the right.`;
}

/**
 * Readable on demand; never a live announcement on every simulation tick.
 * Riders steered on this device also hear their room to each side.
 */
export function arenaDescription(
  state: LightCyclesState,
  controlled: readonly GameSide[] = []
): string {
  const size = t`Arena ${state.width} columns by ${state.height} rows.`;
  const riders = state.riders.map((rider) => {
    const name = riderName(rider.seat);
    const column = rider.x + 1;
    const row = rider.y + 1;
    if (!rider.alive)
      return t`${name} has crashed at column ${column}, row ${row}.`;
    const heading = directionText(rider.heading);
    const parts = [
      t`${name}: column ${column}, row ${row}, heading ${heading}.`,
    ];
    const next = plannedHeading(rider);
    if (next !== rider.heading)
      parts.push(t`Next turn: ${directionText(next)}.`);
    if (controlled.includes(rider.seat))
      parts.push(roomText(state, rider.x, rider.y, rider.heading));
    return parts.join(' ');
  });
  return [size, ...riders].join(' ');
}

function winnerText(winner: GameSide | 'draw'): string {
  return winner === 'draw'
    ? t`The round is drawn.`
    : t`${riderName(winner)} wins the round.`;
}

export function arenaOverlay(
  state: LightCyclesState
): TrailOverlay | undefined {
  if (state.phase === 'countdown')
    return {
      title: String(
        Math.max(
          1,
          Math.ceil((config.countdownTicks - state.phaseTick) / config.tickRate)
        )
      ),
      detail: t`Round ${state.round}`,
    };
  if (state.phase === 'round-over' && state.roundWinner !== null)
    return {
      title: winnerText(state.roundWinner),
      detail: t`Next round soon.`,
    };
  if (state.phase === 'completed' && state.result !== null)
    return {
      title:
        state.result.winner === 'draw'
          ? t`The game is drawn.`
          : t`${riderName(state.result.winner)} wins the game.`,
    };
  return undefined;
}

export function steeringOf(
  state: LightCyclesState,
  controls: GameSimulationControls | undefined,
  side: GameSide | undefined
): LightCyclesSteering {
  // A finished game hands nobody steering controls: say why, rider or not.
  if (state.phase === 'completed') return 'finished';
  if (controls === undefined || side === undefined) return 'watching';
  if (controls.elsewhere?.includes(side) === true) return 'elsewhere';
  if (controls.stale || controls.paused) return 'away';
  if (state.phase === 'round-over') return 'round-over';
  if (state.riders.find((rider) => rider.seat === side)?.alive !== true)
    return 'crashed';
  return state.phase === 'countdown' ? 'countdown' : 'riding';
}

export function steeringText(
  steering: LightCyclesSteering,
  side: GameSide | undefined
): string {
  const name = side === undefined ? '' : riderName(side);
  switch (steering) {
    case 'watching':
      return t`Watching. Only a rider's own person steers it.`;
    case 'elsewhere':
      return t`You ride ${name} from another of your devices.`;
    case 'away':
      return t`Reconnecting. Steering resumes when the game returns.`;
    case 'finished':
      return t`The Light Cycles game is finished.`;
    case 'round-over':
      return t`The round result is showing. The next round starts soon.`;
    case 'crashed':
      return t`${name} has crashed in this round. Watch until the next round.`;
    case 'countdown':
      return t`Get ready: a turn chosen now takes effect on ${name}'s first step.`;
    case 'riding':
      return t`You ride ${name}.`;
  }
}
