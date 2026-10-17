/**
 * A test-only game, never shipped: a race to five where each turn counts one
 * more. It is registered, rendered and played purely through the platform's
 * public contracts — a shared definition, a client definition and a harness
 * game — so it proves a new game needs no change to any shared screen,
 * workflow or suite. It offers custom games and history, not matchmaking.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type {
  GameBoardProps,
  GamePresentation,
} from '@pkgs/turn-game-shared/game-presentation';
import type {
  GameRules,
  RegisteredTurnGame,
} from '@pkgs/turn-game-shared/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import type { JSX } from 'solid-js';

const FINISH = 5;
const count = (position: string) => Number(position.slice('race:'.length));

const rules: GameRules = {
  id: 'counting-race',
  botDifficulties: ['easy'],
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
  replay: (_actions, ply) => `race:${Math.min(ply, FINISH)}`,
  legal: (position) => (count(position) >= FINISH ? [] : ['advance']),
  canWin: () => true,
  choose: (position) => (count(position) >= FINISH ? null : 'advance'),
  moves: (position) =>
    Array.from({ length: count(position) }, (_, ply) => ({
      label: `step ${ply + 1}`,
      before: `race:${ply}`,
      after: `race:${ply + 1}`,
    })),
  record: (position) => position,
};

const automation: GameAutomation<Driver> = {
  rules,
  choose: (position) => rules.choose(position, 'easy', () => 0),
  async perform(ui, board, action) {
    await ui.get(`${board}-${action}`).tap();
  },
};

const turnGame: RegisteredTurnGame = {
  rules,
  controlPrefix: 'counting-race/',
  notice: {
    timeoutDraw: () => 'Drawn on time.',
    side: (side) => (side === 'white' ? 'Hare' : 'Tortoise'),
    ending: (reason) => (reason === 'finish line' ? 'First to five.' : undefined),
  },
  capabilities: ['custom-games', 'history'],
};

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

const presentation: GamePresentation<JSX.Element> = {
  id: rules.id,
  canFlip: false,
  name: () => 'Counting race',
  Board,
  sideLabel: (side) => (side === 'white' ? 'Hare' : 'Tortoise'),
  endingDescription: (reason) =>
    reason === 'finish line' ? 'First to five.' : undefined,
  timeoutDrawDescription: () => 'Drawn on time.',
  endingLabel: () => 'finish line',
};

export const COUNTING_RACE_GAME: HarnessGame = assertHarnessGame({
  label: 'counting race',
  shared: {
    id: rules.id,
    automation,
    turnGame,
    roomCapabilities: [GAME_ROOM_CAPABILITY],
    commandRouters: [],
    eventRouters: [],
    recoverEffects: () => [],
  },
  client: defineGameClient({
    id: rules.id,
    title: 'Counting race',
    caption: 'Count to five first',
    subtitle: () => 'Take turns counting on.',
    presentation,
  }),
  firstSideVictory: ['advance', 'advance', 'advance', 'advance', 'advance'],
});
