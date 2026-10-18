import type { ReadGameRecord } from '@libs/game-session-harness/harness-game';

/** The parts of a Connect Four record (JSON) the shared suites read. */
type ConnectFourRecord = {
  readonly metadata?: {
    readonly participants?: readonly { readonly name?: string }[];
    readonly outcome?: string;
    readonly timeControl?: {
      readonly minutes: number;
      readonly incrementSeconds: number;
      readonly daysPerMove: number;
    } | null;
  };
  readonly columns?: readonly number[];
};

const RESULTS: Readonly<Record<string, ReadGameRecord['result']>> = {
  white: 'white',
  black: 'black',
  draw: 'draw',
};

function clockChoiceOf(
  clock: NonNullable<ConnectFourRecord['metadata']>['timeControl']
): string | null {
  if (clock === undefined || clock === null) return null;
  return clock.daysPerMove > 0
    ? `${String(clock.daysPerMove)}d`
    : `${String(clock.minutes)}+${String(clock.incrementSeconds)}`;
}

/**
 * A Connect Four game record read back: the two sides' names, the result,
 * the clock choice and every move as the column it was dropped in, counted
 * from 1.
 */
export function readConnectFourRecord(record: string): ReadGameRecord {
  const read = JSON.parse(record) as ConnectFourRecord;
  const [first, second] = read.metadata?.participants ?? [];
  return {
    firstSide: first?.name ?? null,
    secondSide: second?.name ?? null,
    result: RESULTS[read.metadata?.outcome ?? ''] ?? null,
    clockChoice: clockChoiceOf(read.metadata?.timeControl),
    moves: (read.columns ?? []).map(String),
  };
}
