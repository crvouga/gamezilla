/**
 * The reference game: test-only, never shipped. A race to seven where each
 * turn counts one more, registered, rendered and played purely through the
 * platform's public contracts — `defineTurnGame`, `defineGameClient` and a
 * `HarnessGame` — and enrolled in every shared suite beside the registered
 * games (`tests/conformance-world.ts`). It proves a new game needs no change
 * to any shared screen, workflow, specification or suite, and it offers
 * custom games and history but not matchmaking, so the matrix holds an
 * unsupported capability too.
 */

import type { GameClient } from '@libs/game-menu-client/game-client';
import { defineGameClient } from '@libs/game-menu-client/game-client';
import type {
  GameFixtures,
  HarnessGame,
} from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import type { JSX } from 'solid-js';

/**
 * Seven, the length of the victory every custom-game model follows
 * (`tests/quint/model-game.ts`), so the first side counts the last number.
 */
const FINISH = 7;
const count = (position: string) => Number(position.slice('race:'.length));

export const COUNTING_RACE_RULES: GameRules = {
  id: 'counting-race',
  recognizes: (position) => /^race:[0-7]$/.test(position),
  initial: () => 'race:0',
  play(position, action, history) {
    const at = count(position);
    if (action !== 'advance' || at >= FINISH) return null;
    const next = at + 1;
    return {
      position: `race:${next}`,
      history: `${history}${history === '' ? '' : ' '}${next}`,
      turn: next % 2 === 0 ? 'white' : 'black',
      label: `step ${next}`,
      winner: next === FINISH ? 'white' : null,
      reason: next === FINISH ? 'finish line' : null,
    };
  },
  replay: (actions, ply) =>
    `race:${Math.min(actions.slice(0, ply).length, FINISH)}`,
  legal: (position) => (count(position) >= FINISH ? [] : ['advance']),
  canWin: () => true,
  moves: (position) =>
    Array.from({ length: count(position) }, (_, ply) => ({
      label: `step ${ply + 1}`,
      before: `race:${ply}`,
      after: `race:${ply + 1}`,
    })),
};

const advance = (position: string) =>
  count(position) >= FINISH ? null : 'advance';

function Board(props: GameBoardProps): JSX.Element {
  return (
    <div data-testid={props.testId} data-position={props.position}>
      <button
        type="button"
        data-testid={`${props.testId}-advance`}
        disabled={!props.interactive}
        onClick={() => props.onAction('advance')}
      >
        Count on from {count(props.position)}
      </button>
    </div>
  );
}

const sideLabel = (side: 'white' | 'black') =>
  side === 'white' ? 'Hare' : 'Tortoise';

/**
 * What the reference game hands `defineTurnGame` and `defineGameClient`:
 * a faulty copy (`faulty-games.test.ts`) changes one part and is defined
 * through the same constructors, as any game would be.
 */
export const COUNTING_RACE_TURN_GAME: TurnGame = {
  rules: COUNTING_RACE_RULES,
  capabilities: {
    'custom-games': {
      bots: { difficulties: ['easy'], choose: advance },
    },
    history: { record: (position) => position },
  },
  automation: {
    choose: advance,
    async perform(ui, board, action) {
      await ui.get(`${board}-${action}`).tap();
    },
  },
};

export const COUNTING_RACE_SHARED = defineTurnGame(COUNTING_RACE_TURN_GAME);

export const COUNTING_RACE_CLIENT: GameClient = {
  shared: COUNTING_RACE_SHARED,
  title: 'Counting race',
  caption: 'Count to seven first',
  subtitle: () => 'Take turns counting on.',
  presentation: {
    canFlip: false,
    name: () => 'Counting race',
    Board,
    sideLabel,
    endingDescription: (reason) =>
      reason === 'finish line' ? 'First to seven.' : undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'finish line',
  },
};

export const COUNTING_RACE_FIXTURES: GameFixtures = {
  firstSideVictory: [
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
    'advance',
  ],
  // Each count is written as the step it reaches.
  firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map((step) => `step ${step}`),
  refusedOpenings: ['retreat', ''],
};

export const COUNTING_RACE_GAME: HarnessGame = assertHarnessGame({
  label: 'counting race',
  shared: COUNTING_RACE_SHARED,
  client: defineGameClient(COUNTING_RACE_CLIENT),
  fixtures: COUNTING_RACE_FIXTURES,
});
