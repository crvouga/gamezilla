/** A speed family; each has its own multiplayer rating. */
export type MultiplayerSpeed = 'bullet' | 'blitz' | 'rapid' | 'classical';

export const MULTIPLAYER_SPEEDS: readonly MultiplayerSpeed[] = [
  'bullet',
  'blitz',
  'rapid',
  'classical',
];

export type TimeControl = {
  /** As people write it: minutes each side starts with + increment seconds. */
  readonly id: string;
  readonly minutes: number;
  readonly incrementSeconds: number;
  readonly speed: MultiplayerSpeed;
};

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
  };
}

/** The only time controls multiplayer chess offers; no game is untimed. */
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
];

export const DEFAULT_TIME_CONTROL = '5+0';

export function timeControlOf(id: string | null | undefined): TimeControl | null {
  return TIME_CONTROLS.find((c) => c.id === id) ?? null;
}

export function startingMs(id: string | null | undefined): number {
  return (timeControlOf(id)?.minutes ?? 0) * 60_000;
}

export function incrementMs(id: string | null | undefined): number {
  return (timeControlOf(id)?.incrementSeconds ?? 0) * 1000;
}

/** A stable, selector-safe name for one time control (`5+0` → `5-0`). */
export function timeControlKey(id: string): string {
  return id.replace('+', '-');
}
