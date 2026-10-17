import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
/** A speed family; each has its own multiplayer rating. */
export type ClockSpeed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';

export type MultiplayerSpeed = ClockSpeed | `${string}:${ClockSpeed}`;

export const MULTIPLAYER_SPEEDS: readonly MultiplayerSpeed[] = [
  'bullet',
  'blitz',
  'rapid',
  'classical',
  'daily',
];

export type TimeControl = {
  /**
   * Minutes each side starts with + increment seconds (`5+0`), or a daily
   * time control's days for every move (`3d`).
   */
  readonly id: string;
  readonly minutes: number;
  readonly incrementSeconds: number;
  readonly speed: MultiplayerSpeed;
  /** Days each person has for every move of a daily game; 0 otherwise. */
  readonly daysPerMove: number;
};

const MINUTES_PER_DAY = 24 * 60;

function control(
  minutes: number,
  incrementSeconds: number,
  speed: MultiplayerSpeed
): TimeControl {
  return {
    id: `${String(minutes)}+${String(incrementSeconds)}`,
    minutes,
    incrementSeconds,
    speed,
    daysPerMove: 0,
  };
}

function daily(daysPerMove: number): TimeControl {
  return {
    id: dailyTimeControlId(daysPerMove),
    minutes: daysPerMove * MINUTES_PER_DAY,
    incrementSeconds: 0,
    speed: 'daily',
    daysPerMove,
  };
}

/** The id of the daily time control with this many days per move (`3d`). */
export function dailyTimeControlId(daysPerMove: number): string {
  return `${String(daysPerMove)}d`;
}

/** The only time controls multiplayer game offers; no game is untimed. */
export const TIME_CONTROLS: readonly TimeControl[] = [
  control(1, 0, 'bullet'),
  control(2, 1, 'bullet'),
  control(3, 0, 'blitz'),
  control(3, 2, 'blitz'),
  control(5, 0, 'blitz'),
  control(5, 3, 'blitz'),
  control(10, 0, 'rapid'),
  control(10, 5, 'rapid'),
  control(15, 10, 'rapid'),
  control(30, 0, 'classical'),
  control(30, 20, 'classical'),
  daily(1),
  daily(3),
  daily(7),
];

export const DEFAULT_TIME_CONTROL = '5+0';

export function timeControlOf(
  id: string | null | undefined
): TimeControl | null {
  const plain = id?.split('/').at(-1);
  const found = TIME_CONTROLS.find((c) => c.id === plain);
  if (found === undefined) return null;
  return id?.includes('/')
    ? {
        ...found,
        id,
        speed: `${id.split('/')[0]}:${found.speed}` as MultiplayerSpeed,
      }
    : found;
}

/** The rating speed of `speed` in a game's clock namespace (`''` or `<id>/`). */
export function gameSpeed(
  controlPrefix: string,
  speed: MultiplayerSpeed
): MultiplayerSpeed {
  return controlPrefix === ''
    ? speed
    : (`${controlPrefix.slice(0, -1)}:${speed}` as MultiplayerSpeed);
}

export function startingMs(id: string | null | undefined): number {
  return (timeControlOf(id)?.minutes ?? 0) * 60_000;
}

export function incrementMs(id: string | null | undefined): number {
  return (timeControlOf(id)?.incrementSeconds ?? 0) * 1000;
}

/** Days per move of a daily time control; 0 for every other one. */
export function daysPerMoveOf(id: string | null | undefined): number {
  return timeControlOf(id)?.daysPerMove ?? 0;
}

/** A daily game gives each person days for every move instead of a bank. */
export function isDailyTimeControl(id: string | null | undefined): boolean {
  return daysPerMoveOf(id) > 0;
}

/** A stable, selector-safe name for one time control (`5+0` → `5-0`). */
export function timeControlKey(id: string): string {
  return id.replace('+', '-');
}

/** Offered controls are configured by the injected game registrations. */
export function offeredTimeControls(rules: TurnGames): readonly TimeControl[] {
  return rules.games.flatMap((game) =>
    TIME_CONTROLS.map(
      (control) => timeControlOf(game.controlPrefix + control.id)!
    )
  );
}
