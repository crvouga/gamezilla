import type { GameRecordMetadata } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  decodeBattleshipPosition,
  parseShotAction,
  shotLabel,
} from './battleship-position';

/**
 * The downloaded record: its ruleset, the finished game and its shots in
 * the order fired. Only public shots are recorded; never a fleet.
 */
export function battleshipRecord(
  position: string,
  _history: string,
  metadata: GameRecordMetadata
): string {
  const { actions } = decodeBattleshipPosition(position);
  return JSON.stringify({
    game: 'battleship',
    ruleset: 'classic-10x10-v1',
    metadata,
    position,
    shots: actions.map((action) => shotLabel(parseShotAction(action)!)),
  });
}
