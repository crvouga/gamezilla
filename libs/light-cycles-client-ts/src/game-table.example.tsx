import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import type {
  GameSeatLook as FrameSeatLook,
  GameFrameSeat,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type {
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import {
  GameResultHeadline,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import type { GameSeatLook } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, mergeProps, Show, untrack } from 'solid-js';
import { fn } from 'storybook/test';

/** Story args for a board: a seated, waiting player with no private state. */
export function boardArgs(
  position: string,
  overrides: Partial<GameBoardProps> = {}
): GameBoardProps {
  return {
    position,
    orientation: 'white',
    interactive: false,
    sound: false,
    syncKey: 0,
    onAction: fn(),
    testId: 'custom-game-board',
    setup: null,
    hand: null,
    committed: [],
    commitment: null,
    ...overrides,
  };
}

/** Board props no Storybook control can edit. */
export const BOARD_CONTROLS_EXCLUDE = [
  'simulation',
  'onAction',
  'committed',
] as const;

/**
 * Story-only: what the shared game frame shows of a game around its board,
 * read from the game's own presentation. The frame itself is the platform's
 * (`@libs/game-session-client-ts`); this composes the same design-system
 * parts from the data a game supplies, so a game's stories show its seat
 * names, looks, figures and facts, its turn line, its board actions and its
 * result as a person sees them.
 */
export type GameTableStory = {
  /** The person's own seat; `null` for a watcher. Defaults to the board's orientation. */
  readonly viewer?: GameSide | null;
  /** The side to move, for the frame's own `<Side> to move.` line. */
  readonly turn?: GameSide | null;
  /** How a finished game ended. */
  readonly ending?: {
    readonly winner: GameWinner;
    readonly reason: string;
  };
};

type GameTableProps = GameTableStory & {
  readonly presentation: GameClientPresentation;
  readonly sides: readonly GameSide[];
  readonly board: GameBoardProps;
};

/** A seat's look as the design system's swatch draws it (`3` → `player3`). */
function swatch(look: FrameSeatLook): GameSeatLook {
  return look.color === undefined
    ? { mark: look.mark }
    : { color: `player${look.color}`, mark: look.mark };
}

function GameTable(props: GameTableProps): JSX.Element {
  const frame = () => props.presentation.frame;
  const viewer = (): GameSide | null =>
    props.viewer === undefined ? props.board.orientation : props.viewer;
  const seats = (): readonly GameFrameSeat[] =>
    props.sides.map((side) => ({ side, look: frame().seats.look(side) }));
  // A board session is made once, as the frame makes it when it mounts.
  const session = untrack(() => {
    const board = mergeProps(props.board, {
      get viewer() {
        return viewer();
      },
      get seats() {
        return seats();
      },
    });
    return frame().createBoard(board);
  });
  const seat = (side: GameSide) => {
    const name = props.presentation.sideLabel(side);
    const position = props.board.position;
    const seats = frame().seats;
    return (
      <GamePlayerBar
        name={side === viewer() ? `${name} (you)` : name}
        swatch={swatch(seats.look(side))}
        stat={seats.stat(position, side)}
        state={seats.out(position, side) ? { kind: 'out', label: 'Out' } : null}
        active={props.ending === undefined && side === props.turn}
        tags={
          <For each={seats.facts(position, side, props.board.committed)}>
            {(fact) => <Badge intent="neutral" label={fact} />}
          </For>
        }
      />
    );
  };
  const turnLine = (): string => {
    const line = frame().turnStatus(
      props.board.position,
      viewer(),
      props.board.committed
    );
    if (line !== null) return line;
    const turn = props.turn;
    if (turn === undefined || turn === null) return '';
    return turn === viewer()
      ? 'Your turn.'
      : `${props.presentation.sideLabel(turn)} to move.`;
  };
  const others = () => props.sides.filter((side) => side !== viewer());
  const own = () => viewer();
  // Inside the game template, as the frame shows a board: the same page
  // inset around the board, never touching the screen's edges.
  return (
    <GameScreen screenId="game-table" title={undefined}>
      <StackVertical gap="lg">
        <GameBoardStage
          others={
            <StackVertical gap="xs">
              <For each={others()}>{(side) => seat(side)}</For>
            </StackVertical>
          }
          turn={
            <Show when={props.ending === undefined && turnLine() !== ''}>
              <GameTurnPill
                title={turnLine()}
                emphasis={props.turn === viewer() ? 'yours' : 'neutral'}
              />
            </Show>
          }
          own={<Show when={own()}>{(side) => seat(side())}</Show>}
        >
          <StackVertical gap="sm">
            <session.Board />
            <Show when={session.controls}>{(controls) => controls()()}</Show>
            <Show when={session.actions().length > 0}>
              <GameActionBar
                aria-label="Board actions"
                items={session.actions().map((action) => ({
                  id: action.id,
                  label: action.label,
                  testId: `${props.board.testId}-${action.id}`,
                  onPress: action.run,
                  disabled: !action.enabled,
                  emphasis: action.emphasis,
                  pressed: action.pressed,
                }))}
              />
            </Show>
          </StackVertical>
        </GameBoardStage>
        <Show when={props.ending}>
          {(ending) => <GameResult {...props} ending={ending()} />}
        </Show>
      </StackVertical>
    </GameScreen>
  );
}

function GameResult(
  props: GameTableProps & {
    readonly ending: NonNullable<GameTableStory['ending']>;
  }
): JSX.Element {
  const viewer = (): GameSide | null =>
    props.viewer === undefined ? props.board.orientation : props.viewer;
  const summary = () =>
    props.presentation.frame.result(props.board.position, props.ending.winner);
  const winners = () =>
    summary()
      .standings.filter((standing) => standing.place === 1)
      .map((standing) => standing.side);
  const title = (): string => {
    if (winners().length === props.sides.length) return 'Draw';
    const own = viewer();
    if (own !== null && winners().includes(own)) return 'You win';
    return `${winners().map(props.presentation.sideLabel).join(' and ')} ${winners().length === 1 ? 'wins' : 'win'}`;
  };
  return (
    <StackVertical gap="md">
      <GameResultHeadline
        title={title()}
        caption={props.presentation.endingDescription(props.ending.reason)}
      />
      <GameStandings
        aria-label="Standings"
        scoreLabel={summary().scoreLabel}
        rows={summary().standings.map((standing) => ({
          id: standing.side,
          place: standing.place,
          name: props.presentation.sideLabel(standing.side),
          score: standing.score,
          you: standing.side === viewer(),
        }))}
      />
    </StackVertical>
  );
}

/**
 * What a story renders: the board, given by the story's args, inside
 * {@link GameTable}; a story says who is looking, whose turn it is and how
 * the game ended with `parameters: { table: GameTableStory }`.
 */
export function renderGameTable(
  presentation: GameClientPresentation,
  sides: readonly GameSide[],
  args: GameBoardProps,
  context: { readonly parameters: Readonly<Record<string, unknown>> }
): JSX.Element {
  const table = (context.parameters['table'] ?? {}) as GameTableStory;
  return (
    <GameTable
      presentation={presentation}
      sides={sides}
      board={args}
      {...table}
    />
  );
}
