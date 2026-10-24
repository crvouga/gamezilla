import type { ReadGameRecord } from '@libs/game-session-harness-ts/harness-game';

type QuoridorRecord = {
  readonly metadata: {
    readonly participants: readonly { readonly name: string }[];
    readonly outcome: ReadGameRecord['result'];
    readonly timeControl: {
      readonly minutes: number;
      readonly incrementSeconds: number;
      readonly daysPerMove: number;
    } | null;
  };
  readonly actions: readonly string[];
};

export function readQuoridorRecord(record: string): ReadGameRecord {
  const read = JSON.parse(record) as QuoridorRecord;
  const clock = read.metadata.timeControl;
  return {
    firstSide: read.metadata.participants[0]?.name ?? null,
    secondSide: read.metadata.participants[1]?.name ?? null,
    participants: read.metadata.participants.map(
      (participant) => participant.name
    ),
    result: read.metadata.outcome,
    clockChoice:
      clock === null
        ? null
        : clock.daysPerMove > 0
          ? `${clock.daysPerMove}d`
          : `${clock.minutes}+${clock.incrementSeconds}`,
    moves: read.actions,
  };
}
