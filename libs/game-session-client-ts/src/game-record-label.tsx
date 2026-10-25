import { t } from '@lingui/core/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameHistoryRecord } from './use-game-records';
import { sideNames } from './side-names';

/** Stored seat and result codes never become player-facing labels. */
export function useGameRecordLabel(): (record: GameHistoryRecord) => string {
  const presentation = useGamePresentation();
  return (record) => {
    if (record.result === 'aborted') return t`Game cancelled.`;
    if (record.result === 'draw') {
      if (record.reason === 'timeout')
        return t`Game drawn because a participant ran out of time.`;
      if (record.reason === 'participant withdrew')
        return t`Game drawn because a participant withdrew.`;
      return t`Game drawn.`;
    }
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

function ending(reason: string, label: (value: string) => string): string {
  if (reason.includes('resignation')) return t`resignation`;
  if (reason.includes('time')) return t`time`;
  if (reason === 'account deletion') return t`account deletion`;
  if (reason.includes('stayed away')) return t`opponent staying away`;
  return label(reason.split(/ wins? by /).at(-1) ?? '');
}
