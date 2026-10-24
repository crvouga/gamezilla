import { t } from '@lingui/core/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import {
  GAME_SIDES,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameHistoryRecord } from './use-game-records';

/** Stored seat and result codes never become player-facing labels. */
export function useGameRecordLabel(): (record: GameHistoryRecord) => string {
  const presentation = useGamePresentation();
  return (record) => {
    if (record.outcome === 'aborted') return t`Game cancelled.`;
    if (record.outcome === 'draw') {
      if (record.reason === 'timeout')
        return t`Game drawn because a participant ran out of time.`;
      if (record.reason === 'participant withdrew')
        return t`Game drawn because a participant withdrew.`;
      return t`Game drawn.`;
    }
    const game = presentation(record.position);
    const winner = game.sideLabel(
      GAME_SIDES.includes(record.outcome as GameSide)
        ? (record.outcome as GameSide)
        : 'white'
    );
    const reason = ending(record.reason, game.endingLabel);
    return t`${winner} wins by ${reason}.`;
  };
}

function ending(reason: string, label: (value: string) => string): string {
  if (reason.includes('resignation')) return t`resignation`;
  if (reason.includes('time')) return t`time`;
  if (reason === 'account deletion') return t`account deletion`;
  if (reason.includes('stayed away')) return t`opponent staying away`;
  return label(reason.split(' wins by ').at(-1) ?? '');
}
