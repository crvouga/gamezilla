import { expect, test } from 'bun:test';
import { playMultiplayerMove } from '@libs/game-matchmaking-shared/game';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { awaitingSetups } from '@libs/game-matchmaking-shared/game-state';
import {
  FIRST_MOVE_MS,
  multiplayerDeadlineMs,
  SETUP_MS,
  settleMultiplayerClock,
} from '@libs/game-matchmaking-shared/multiplayer-clock';
import { chooseSetup } from '@libs/game-matchmaking-shared/multiplayer-setup';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

/**
 * A tiny game with private setups, written for this test: each side hides
 * one number, and the first side wins by naming the second side's number.
 */
const hidden: GameRules = {
  id: 'hidden',
  recognizes: (p) => /^hidden:(|g[1-9]:(found|missed))$/.test(p),
  initial: () => 'hidden:',
  play: (position, action) =>
    position === 'hidden:' && /^g[1-9]:(found|missed)$/.test(action)
      ? {
          position: `hidden:${action}`,
          history: action,
          turn: 'black',
          label: action,
          winner: action.endsWith('found') ? 'white' : null,
          reason: action.endsWith('found') ? 'found' : null,
        }
      : null,
  replay: (actions, ply) => `hidden:${actions.slice(0, ply).join('')}`,
  legal: (p) => (p === 'hidden:' ? ['g3', 'g7'] : []),
  canWin: () => true,
  moves: () => [],
  setup: {
    accept: (s) => (/^n[1-9]$/.test(s) ? s : null),
    random: () => 'n1',
    resolve: (position, proposal, setups) =>
      position === 'hidden:' && /^g[1-9]$/.test(proposal)
        ? `${proposal}:${setups.black === `n${proposal.slice(1)}` ? 'found' : 'missed'}`
        : null,
  },
};
const RULES = createTurnGames([
  {
    rules: hidden,
    capabilities: {
      matchmaking: {
        clockNamespace: 'hidden/',
        notice: {
          timeoutDraw: () => '',
          side: String,
          ending: () => undefined,
        },
      },
      history: { record: String },
    },
  },
]);

const START = 1_000_000;
const paired: MultiplayerGame = {
  id: 'match',
  white_id: 'alice',
  black_id: 'bob',
  turn: 'alice',
  fen: 'hidden:',
  pgn: '',
  revision: 0,
  outcome: 'ongoing',
  reason: null,
  time_control: 'hidden/5+0',
  white_ms: 300_000,
  black_ms: 300_000,
  clock_at_ms: START,
  paused_at_ms: null,
  draw_offer_by: null,
  rematch_offer_by: null,
  rematch_of: null,
  white_rating: null,
  black_rating: null,
  white_rating_diff: null,
  black_rating_diff: null,
  setup_ready: '',
};

function code(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
  return '';
}

function ready(
  game: MultiplayerGame,
  actorId: string,
  setup: string,
  nowMs = START
) {
  return chooseSetup(game, { actorId, setup, nowMs }, RULES).game;
}

test('each person chooses one setup, publicly ready while the setup stays hidden', () => {
  const chosen = chooseSetup(
    paired,
    { actorId: 'bob', setup: 'n7', nowMs: START },
    RULES
  );
  expect(chosen.setup).toBe('n7');
  expect(chosen.game.setup_ready).toBe('black');
  expect(JSON.stringify(chosen.game)).not.toContain('n7');
  expect(awaitingSetups(chosen.game)).toBe(true);
  expect(code(() => ready(chosen.game, 'bob', 'n4'))).toBe(
    'CHESS_SETUP_CHOSEN'
  );
  expect(code(() => ready(paired, 'alice', 'n0'))).toBe(
    'CHESS_SETUP_INCOMPLETE'
  );
});

test('no first move is taken until both setups are chosen', () => {
  const half = ready(paired, 'alice', 'n3');
  const move = { actorId: 'alice', revision: 0, uci: 'g7', nowMs: START };
  expect(
    code(() => playMultiplayerMove(half, { ...move, setups: null }, RULES))
  ).toBe('CHESS_SETUP_UNFINISHED');
});

test('the server resolves a move with both setups into its public result', () => {
  const both = ready(ready(paired, 'alice', 'n3'), 'bob', 'n7', START + 5000);
  const won = playMultiplayerMove(
    both,
    {
      actorId: 'alice',
      revision: 0,
      uci: 'g7',
      nowMs: START + 6000,
      setups: { white: 'n3', black: 'n7' },
    },
    RULES
  );
  expect(won.fen).toBe('hidden:g7:found');
  expect(won.outcome).toBe('white');
  const forged = {
    actorId: 'alice',
    revision: 0,
    uci: 'g3:found',
    nowMs: START + 6000,
  };
  expect(
    code(() =>
      playMultiplayerMove(
        both,
        { ...forged, setups: { white: 'n3', black: 'n7' } },
        RULES
      )
    )
  ).toBe('CHESS_ILLEGAL_MOVE');
});

test('an unfinished setup aborts the game at its deadline, with no result', () => {
  const half = ready(paired, 'alice', 'n3');
  expect(multiplayerDeadlineMs(half)).toBe(START + SETUP_MS);
  expect(
    settleMultiplayerClock(half, START + SETUP_MS - 1, RULES).outcome
  ).toBe('ongoing');
  const missed = settleMultiplayerClock(half, START + SETUP_MS, RULES);
  expect([missed.outcome, missed.reason]).toEqual(['aborted', 'setup missed']);
});

test("the first side's first-move wait begins once both setups are chosen", () => {
  const both = ready(ready(paired, 'alice', 'n3'), 'bob', 'n7', START + 90_000);
  expect(awaitingSetups(both)).toBe(false);
  expect(multiplayerDeadlineMs(both)).toBe(START + 90_000 + FIRST_MOVE_MS);
});
