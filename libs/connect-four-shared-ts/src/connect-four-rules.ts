import type {
  GameBots,
  GameRecordMetadata,
  GameRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  decodeConnectFour,
  dropDisc,
  encodeConnectFour,
  legalColumns,
  newConnectFour,
  replayConnectFour,
} from './connect-four';
import { BOT_DIFFICULTIES, chooseConnectFourColumn } from './connect-four-bot';
/** Only the canonical one-character column identifiers enter accepted history. */
export function parseConnectFourColumn(action: string): number | null {
  return action.length === 1 && /^[0-6]$/.test(action) ? Number(action) : null;
}
export const connectFourRules: GameRules = {
  id: 'connect-four',
  recognizes: (position) => position.startsWith('c4:'),
  initial: () => encodeConnectFour(newConnectFour()),
  play(position, action) {
    const column = parseConnectFourColumn(action);
    if (column === null) return null;
    const next = dropDisc(decodeConnectFour(position), column);
    if (next === null) return null;
    return {
      position: encodeConnectFour(next),
      history: next.moves.join(''),
      turn: next.turn === 1 ? 'white' : 'black',
      label: String(Number(action) + 1),
      winner:
        next.result === 0
          ? null
          : next.result === 3
            ? 'draw'
            : next.result === 1
              ? 'white'
              : 'black',
      reason:
        next.result === 0
          ? null
          : next.result === 3
            ? 'full board'
            : 'four in a row',
    };
  },
  replay(actions, ply) {
    const columns = actions.slice(0, ply).map((action) => {
      const column = parseConnectFourColumn(action);
      if (column === null)
        throw new Error('Invalid Connect Four action history');
      return column;
    });
    return encodeConnectFour(replayConnectFour(columns));
  },
  legal: (position) => legalColumns(decodeConnectFour(position)).map(String),
  canWin: () => true,
  moves(position) {
    const drops = decodeConnectFour(position).moves;
    return drops.map((column, index) => ({
      label: String(column + 1),
      before: encodeConnectFour(replayConnectFour(drops.slice(0, index))),
      after: encodeConnectFour(replayConnectFour(drops.slice(0, index + 1))),
    }));
  },
};
export const connectFourBots: GameBots = {
  difficulties: BOT_DIFFICULTIES,
  choose(position, difficulty, random) {
    const column = chooseConnectFourColumn(
      decodeConnectFour(position),
      difficulty,
      random
    );
    return column === null ? null : String(column);
  },
};
/** The downloaded record: its ruleset, the finished game and its columns. */
export function connectFourRecord(
  position: string,
  _history: string,
  metadata: GameRecordMetadata
): string {
  return JSON.stringify({
    game: 'connect-four',
    ruleset: 'classic-7x6-v1',
    metadata,
    position,
    columns: decodeConnectFour(position).moves.map((c) => c + 1),
  });
}
