/**
 * The reference game: test-only, never shipped. A race to five where each
 * turn counts one more, registered, rendered and played purely through the
 * platform's public contracts — `defineTurnGame`, `defineGameClient` and a
 * `HarnessGame` — and enrolled in every shared suite beside the registered
 * games (`tests/conformance-world.ts`). It proves a new game needs no change
 * to any shared screen, workflow, specification or suite, and it offers
 * custom games and history but not matchmaking, so the matrix holds an
 * unsupported capability too.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import type { JSX } from 'solid-js';

const FINISH = 5;
const count = (position: string) => Number(position.slice('race:'.length));

const rules: GameRules = {
  id: 'counting-race',
  recognizes: (position) => /^race:[0-5]$/.test(position),
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

export const COUNTING_RACE_GAME: HarnessGame = assertHarnessGame({
  label: 'counting race',
  shared: defineTurnGame({
    rules,
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
  }),
  client: defineGameClient({
    id: rules.id,
    title: 'Counting race',
    caption: 'Count to five first',
    subtitle: () => 'Take turns counting on.',
    presentation: {
      canFlip: false,
      name: () => 'Counting race',
      Board,
      sideLabel,
      endingDescription: (reason) =>
        reason === 'finish line' ? 'First to five.' : undefined,
      timeoutDrawDescription: () => 'Drawn on time.',
      endingLabel: () => 'finish line',
    },
  }),
  fixtures: {
    firstSideVictory: ['advance', 'advance', 'advance', 'advance', 'advance'],
    refusedOpenings: ['retreat', ''],
  },
});
