/**
 * The test-only private-setup consumer, written as any game is: a guessing
 * game whose sides each hide a number (`secret-pick-rules.ts`). It offers
 * custom games, finding an opponent and history, so every shared suite and
 * specification for private setups runs for a second game beside
 * Battleship, through the same public contracts — and, its known victory
 * taking seven moves, so do the whole-game models Battleship's longer
 * victory cannot follow.
 */

import type { GameClient } from '@libs/game-menu-client-ts/game-client';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type {
  GameFixtures,
  ReadGameRecord,
  TurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import {
  boardOnly,
  fixedPlayers,
  lookOnlySeats,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  GameBoardProps,
  GameSetupBoardProps,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  type TurnGameCapabilities,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { For, type JSX } from 'solid-js';
import {
  SECRET_PICK_BOTS,
  SECRET_PICK_RULES,
  secretPickRecord,
} from './secret-pick-rules';

const SECRETS = ['n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'];

/** The guesses on offer, and the viewer's own hidden number when they have one. */
function Board(props: GameBoardProps): JSX.Element {
  return (
    <div
      data-testid={props.testId}
      data-position={props.position}
      data-own-setup={props.setup ?? ''}
    >
      <For each={SECRET_PICK_RULES.legal(props.position)}>
        {(guess) => (
          <button
            type="button"
            data-testid={`${props.testId}-${guess}`}
            disabled={!props.interactive}
            onClick={() => props.onAction(guess)}
          >
            {guess}
          </button>
        )}
      </For>
    </div>
  );
}

/** Choosing the hidden number. */
function SetupBoard(props: GameSetupBoardProps): JSX.Element {
  return (
    <div data-testid={props.testId} data-setup={props.setup}>
      <For each={SECRETS}>
        {(secret) => (
          <button
            type="button"
            data-testid={`${props.testId}-${secret}`}
            disabled={props.locked}
            aria-pressed={props.setup === secret}
            onClick={() => props.onChange(secret)}
          >
            {secret}
          </button>
        )}
      </For>
    </div>
  );
}

const notice = {
  timeoutDraw: () => 'Drawn on time.',
  side: (side: GameSide) => (side === 'white' ? 'Owl' : 'Fox'),
  ending: (reason: string) =>
    reason === 'found' ? 'found the number' : undefined,
};

const CAPABILITIES = {
  'custom-games': { bots: SECRET_PICK_BOTS },
  matchmaking: {
    clockChoices: true as const,
    namespace: 'secret-pick/',
    notice,
  },
  history: { record: secretPickRecord },
} satisfies TurnGameCapabilities;

export const SECRET_PICK_TURN_GAME: TurnGame<typeof CAPABILITIES> = {
  rules: SECRET_PICK_RULES,
  capabilities: CAPABILITIES,
  turnAutomation: {
    choose: (position, random) =>
      SECRET_PICK_BOTS.choose(position, 'medium', random, null),
    async perform(ui, board, action) {
      await ui.get(`${board}-${action}`).tap();
    },
    async arrange(ui, board, setup) {
      await ui.get(`${board}-${setup}`).tap();
    },
  },
};

export const SECRET_PICK_SHARED = defineGame(SECRET_PICK_TURN_GAME);

export const SECRET_PICK_CLIENT: GameClient<typeof SECRET_PICK_SHARED> = {
  shared: SECRET_PICK_SHARED,
  title: 'Secret pick',
  caption: 'Find the hidden number first',
  subtitle: () => 'Hide a number, then guess theirs.',
  presentation: {
    canFlip: false,
    name: () => 'Secret pick',
    Board,
    SetupBoard,
    sideLabel: notice.side,
    frame: {
      players: fixedPlayers(2),
      options: [],
      seats: lookOnlySeats((side) => ({ color: side === 'white' ? 1 : 2 })),
      createBoard: boardOnly(Board),
      turnStatus: () => null,
      result: (_position, winner) => ({
        scoreLabel: null,
        standings: standingsFromWinner(winner, TWO_PLAYER_SIDES),
      }),
    },
    endingDescription: (reason) =>
      reason === 'found' ? 'Found the hidden number.' : undefined,
    timeoutDrawDescription: () => 'Drawn on time.',
    endingLabel: () => 'found',
  },
};

type SecretPickRecord = {
  readonly metadata?: {
    readonly participants?: readonly { readonly name?: string }[];
    readonly outcome?: string;
    readonly timeControl?: {
      readonly minutes: number;
      readonly incrementSeconds: number;
      readonly daysPerMove: number;
    } | null;
  };
  readonly guesses?: readonly string[];
};

/** The record read back without the game's code. */
function readSecretPickRecord(record: string): ReadGameRecord {
  const read = JSON.parse(record) as SecretPickRecord;
  const [first, second] = read.metadata?.participants ?? [];
  const clock = read.metadata?.timeControl;
  const outcome = read.metadata?.outcome;
  return {
    firstSide: first?.name ?? null,
    secondSide: second?.name ?? null,
    result:
      outcome === 'white' || outcome === 'black' || outcome === 'draw'
        ? outcome
        : null,
    clockChoice:
      clock === undefined || clock === null
        ? null
        : clock.daysPerMove > 0
          ? `${String(clock.daysPerMove)}d`
          : `${String(clock.minutes)}+${String(clock.incrementSeconds)}`,
    moves: read.guesses ?? [],
  };
}

/**
 * Written from the game's own laws: the Owl hides nine and the Fox seven;
 * the Owl guesses one, two, three and seven, and the Fox one, two and four,
 * each told to go higher, until the Owl finds seven.
 */
export const SECRET_PICK_FIXTURES: GameFixtures<typeof CAPABILITIES> = {
  setups: { white: 'n9', black: 'n7' },
  firstSideVictory: ['g1', 'g1', 'g2', 'g2', 'g3', 'g4', 'g7'],
  firstSideVictoryLabels: [
    '1 higher',
    '1 higher',
    '2 higher',
    '2 higher',
    '3 higher',
    '4 higher',
    '7 found',
  ],
  refusedOpenings: ['g0', 'g1:found', 'n7'],
};

export const SECRET_PICK_GAME: TurnHarnessGame = assertHarnessGame({
  label: 'secret pick',
  shared: SECRET_PICK_SHARED,
  client: defineGameClient(SECRET_PICK_CLIENT),
  fixtures: SECRET_PICK_FIXTURES,
  readRecord: readSecretPickRecord,
});
