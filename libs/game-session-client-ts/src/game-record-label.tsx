import { t } from '@lingui/core/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { sideNames } from './side-names';
import type { GameHistoryRecord } from './use-game-records';

/** A finished game's result for one of its players. */
export type GameRecordOutcome = 'won' | 'lost' | 'draw' | 'cancelled';

/** `person`'s result in the game; `null` when they did not play in it. */
export function recordOutcome(
  record: GameHistoryRecord,
  person: string
): GameRecordOutcome | null {
  const side = record.participants.find(
    (participant) => participant.person === person
  )?.side;
  if (side === undefined || person === '') return null;
  if (record.result === 'aborted') return 'cancelled';
  if (record.result === 'draw') return 'draw';
  return record.winners.includes(side) ? 'won' : 'lost';
}

/** Stored seat and result codes never become player-facing labels. */
export function useGameRecordLabel(): (record: GameHistoryRecord) => string {
  const presentation = useGamePresentation();
  return (record) => {
    if (record.result === 'aborted') return t`Game cancelled.`;
    if (record.result === 'draw') return drawn(record.reason);
    const game = presentation(record.position);
    const reason = ending(record.reason, game.endingLabel);
    if (record.winners.length > 1) {
      const winners = sideNames(record.winners.map(game.sideLabel));
      return t`${winners} win by ${reason}.`;
    }
    const winner = game.sideLabel(record.winners[0] ?? 'white');
    return t`${winner} wins by ${reason}.`;
  };
}

/**
 * How the game ended, said to `person`: their own result when they played
 * ("You won by four in a row."), otherwise who won.
 */
export function useGameRecordResult(): (
  record: GameHistoryRecord,
  person: string
) => string {
  const presentation = useGamePresentation();
  const label = useGameRecordLabel();
  return (record, person) => {
    const outcome = recordOutcome(record, person);
    if (outcome !== 'won' && outcome !== 'lost') return label(record);
    const reason = ending(
      record.reason,
      presentation(record.position).endingLabel
    );
    return outcome === 'won'
      ? t`You won by ${reason}.`
      : t`You lost by ${reason}.`;
  };
}

/** How the game ended, without who won ("By four in a row"), for a row that says the result. */
export function useGameRecordEnding(): (record: GameHistoryRecord) => string {
  const presentation = useGamePresentation();
  return (record) => {
    if (record.result === 'aborted') return t`Ended before a result`;
    if (record.result === 'draw') {
      if (record.reason === 'timeout') return t`Drawn on time`;
      if (record.reason === 'participant withdrew')
        return t`Drawn when a participant withdrew`;
      return t`Drawn`;
    }
    const reason = ending(
      record.reason,
      presentation(record.position).endingLabel
    );
    return t`By ${reason}`;
  };
}

function drawn(reason: string): string {
  if (reason === 'timeout')
    return t`Game drawn because a participant ran out of time.`;
  if (reason === 'participant withdrew')
    return t`Game drawn because a participant withdrew.`;
  return t`Game drawn.`;
}

function ending(reason: string, label: (value: string) => string): string {
  if (reason.includes('resignation')) return t`resignation`;
  if (reason.includes('time')) return t`time`;
  if (reason === 'account deletion') return t`account deletion`;
  if (reason.includes('stayed away')) return t`opponent staying away`;
  return label(reason.split(/ wins? by /).at(-1) ?? '');
}
