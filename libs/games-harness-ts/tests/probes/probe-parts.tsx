/**
 * What every probe game draws and how it is played, written as a game
 * writes it, from the framework's public game API alone
 * (`probe-imports.test.ts`): a board of one button per legal action, the
 * copy the shared screens show, and the automation that taps a button.
 * Each probe still makes its own `defineGame` and `defineGameClient`.
 */

import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import {
  boardOnly,
  type FrameSeatCount,
  fixedPlayers,
  type GameFrame,
  lookOnlySeats,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import {
  type GameRules,
  type GameSide,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { For, type JSX } from 'solid-js';

/** What a board and a puzzle board are both given. */
type BoardProps = {
  readonly position: string;
  readonly interactive: boolean;
  readonly onAction: (action: string) => void;
  readonly testId: string;
};

/** A board of one button per action `rules` allow, `<testId>-<action>`. */
export function buttonBoard(rules: GameRules) {
  return function Board(props: BoardProps): JSX.Element {
    return (
      <div data-testid={props.testId} data-position={props.position}>
        <For each={rules.legal(props.position)}>
          {(action) => (
            <button
              type="button"
              data-testid={`${props.testId}-${action}`}
              disabled={!props.interactive}
              onClick={() => props.onAction(action)}
            >
              {action}
            </button>
          )}
        </For>
      </div>
    );
  };
}

/** The first legal action, tapped on the board's button. */
export function probeAutomation(rules: GameRules): TurnGame['turnAutomation'] {
  return {
    choose: (position) => rules.legal(position)[0] ?? null,
    async perform(ui, board, action) {
      await ui.get(`${board}-${action}`).tap();
    },
  };
}

/** What the shared screens say of a probe game. */
export type ProbeCopy = {
  readonly name: string;
  readonly sides: Readonly<Partial<Record<GameSide, string>>>;
  /** Each ending reason its rules give, described. */
  readonly endings: Readonly<Record<string, string>>;
};

/** The frame of a probe: one color per seat, its button board, no scores. */
export function probeFrame(rules: GameRules): GameFrame<JSX.Element> {
  const sides = gameSides(rules);
  return {
    players: fixedPlayers(sides.length as FrameSeatCount),
    options: [],
    seats: lookOnlySeats((side) => ({
      color: (sides.indexOf(side) + 1) as FrameSeatCount,
    })),
    createBoard: boardOnly(buttonBoard(rules)),
    turnStatus: () => null,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, sides),
    }),
  };
}

export function probePresentation(
  rules: GameRules,
  copy: ProbeCopy
): GameClientPresentation {
  return {
    name: () => copy.name,
    canFlip: false,
    Board: buttonBoard(rules),
    frame: probeFrame(rules),
    sideLabel: (side) => {
      const label = copy.sides[side];
      if (label === undefined) throw new Error(`The probe has no ${side} side`);
      return label;
    },
    endingDescription: (reason) =>
      Object.hasOwn(copy.endings, reason) ? copy.endings[reason] : undefined,
    endingLabel: (reason) => reason,
    timeoutDrawDescription: () => 'Drawn on time.',
  };
}
