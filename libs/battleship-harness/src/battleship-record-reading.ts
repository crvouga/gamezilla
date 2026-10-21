import type { ReadGameRecord } from '@libs/game-session-harness/harness-game';

/** The parts of a Battleship record (JSON) the shared suites read. */
type BattleshipRecord = {
  readonly metadata?: {
    readonly participants?: readonly { readonly name?: string }[];
    readonly outcome?: string;
    readonly timeControl?: {
      readonly minutes: number;
      readonly incrementSeconds: number;
      readonly daysPerMove: number;
    } | null;
  };
  readonly shots?: readonly string[];
};

const RESULTS: Readonly<Record<string, ReadGameRecord['result']>> = {
  white: 'white',
  black: 'black',
  draw: 'draw',
};

function clockChoiceOf(
  clock: NonNullable<BattleshipRecord['metadata']>['timeControl']
): string | null {
  if (clock === undefined || clock === null) return null;
  return clock.daysPerMove > 0
    ? `${String(clock.daysPerMove)}d`
    : `${String(clock.minutes)}+${String(clock.incrementSeconds)}`;
}

/** A Battleship record read back without the game's code: both fleets' people, the result, the clock and every shot. */
export function readBattleshipRecord(record: string): ReadGameRecord {
  const read = JSON.parse(record) as BattleshipRecord;
  const [first, second] = read.metadata?.participants ?? [];
  return {
    firstSide: first?.name ?? null,
    secondSide: second?.name ?? null,
    result: RESULTS[read.metadata?.outcome ?? ''] ?? null,
    clockChoice: clockChoiceOf(read.metadata?.timeControl),
    moves: read.shots ?? [],
  };
}
