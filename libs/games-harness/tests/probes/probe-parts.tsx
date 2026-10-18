/**
 * What every probe game draws and how it is played, written as a game
 * writes it, from the framework's public game API alone
 * (`probe-imports.test.ts`): a board of one button per legal action, the
 * copy the shared screens show, and the automation that taps a button.
 * Each probe still makes its own `defineTurnGame` and `defineGameClient`.
 */

import type { GameClientPresentation } from '@libs/game-menu-client/game-client';
import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { GameRules, GameSide } from '@pkgs/turn-game-shared/game-rules';
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
export function probeAutomation(rules: GameRules): TurnGame['automation'] {
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
  readonly sides: Readonly<Record<GameSide, string>>;
  /** Each ending reason its rules give, described. */
  readonly endings: Readonly<Record<string, string>>;
};

export function probePresentation(
  rules: GameRules,
  copy: ProbeCopy
): GameClientPresentation {
  return {
    name: () => copy.name,
    canFlip: false,
    Board: buttonBoard(rules),
    sideLabel: (side) => copy.sides[side],
    endingDescription: (reason) =>
      Object.hasOwn(copy.endings, reason) ? copy.endings[reason] : undefined,
    endingLabel: (reason) => reason,
    timeoutDrawDescription: () => 'Drawn on time.',
  };
}
