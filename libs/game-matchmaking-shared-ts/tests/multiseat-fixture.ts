import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  createTurnGames,
  type GameRules,
} from '@pkgs/turn-game-shared-ts/game-rules';

const sides = ['white', 'black', 'red', 'blue'] as const;
export const MULTISEAT_RULES: GameRules = {
  id: 'four-seat-reference',
  sides,
  recognizes: (position) => position.startsWith('four-seat-reference:'),
  initial: () => 'four-seat-reference:0',
  legal: () => ['step'],
  canWin: () => true,
  replay: (_actions, ply) => `four-seat-reference:${ply}`,
  moves: () => [],
  play(position, action) {
    if (action !== 'step') return null;
    const ply = Number(position.split(':')[1]) + 1;
    return {
      position: `four-seat-reference:${ply}`,
      history: String(ply),
      label: 'Step',
      turn: sides[ply % sides.length]!,
      winner: ply === 7 ? 'red' : null,
      reason: ply === 7 ? 'race finished' : null,
    };
  },
};

export const MULTISEAT_GAMES = createTurnGames([
  {
    rules: MULTISEAT_RULES,
    capabilities: {
      matchmaking: {
        clockChoices: true,
        namespace: 'four-seat-reference/',
        notice: { side: String, ending: String, timeoutDraw: String },
      },
      history: {
        record: (_position, _history, metadata) => JSON.stringify(metadata),
      },
    },
  },
]);

export function multiseatGame(
  patch: Partial<MultiplayerGame> = {}
): MultiplayerGame {
  return {
    id: 'four-people',
    white_id: 'alice',
    black_id: 'bob',
    red_id: 'carol',
    blue_id: 'dave',
    fen: 'four-seat-reference:0',
    pgn: '',
    revision: 0,
    turn: 'alice',
    outcome: 'ongoing',
    reason: null,
    time_control: 'four-seat-reference/3+2',
    white_ms: 180000,
    black_ms: 180000,
    red_ms: 180000,
    blue_ms: 180000,
    clock_at_ms: 0,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: null,
    black_rating: null,
    red_rating: null,
    blue_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
    setup_ready: null,
    ...patch,
  };
}
