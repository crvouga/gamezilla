import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import type {
  GameFrameAction,
  GameFrameBoardProps,
  GameFrameBoardSession,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameActionItem } from '@pkgs/ui-root-client-ts/game-action-bar';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { customGameCanMove } from './custom-game-can-move';
import { useSeatNames } from './custom-game-status';
import { frameTable } from './game-frame-table';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** The board's test id; the board's own actions are `${BOARD_TEST_ID}-${id}`. */
export const BOARD_TEST_ID = 'custom-game-board';

/**
 * The lobby's board preview: the game's own board, never the live one, so
 * nothing reads a game being set up as one being played.
 */
export const BOARD_PREVIEW_TEST_ID = 'custom-game-board-preview';

/**
 * The board's gesture as a choice: while every side commits it is this
 * side's own commitment; otherwise it is a move.
 */
function gestureChoice(
  model: CustomGameScreenModel,
  action: string
): CustomGameInput {
  const game = model.current();
  const ply = game?.moves.length ?? 0;
  const side = model.mySide();
  return side !== null && game?.awaiting.includes(side) === true
    ? { operation: 'commit', commitment: action, ply }
    : { operation: 'move', uci: action, ply };
}

/** The board the frame mounts, its position and whether the person may move. */
export type FrameBoard = {
  readonly session: Accessor<GameFrameBoardSession<JSX.Element> | null>;
  readonly position: Accessor<string>;
  readonly interactive: Accessor<boolean>;
  /** The side the board is drawn from: the person's own, else the first. */
  readonly orientation: Accessor<GameSide>;
};

type BoardState = {
  readonly position: Accessor<string>;
  readonly interactive: Accessor<boolean>;
  readonly orientation: Accessor<GameSide>;
  /** Bumped when a gesture is refused, so the board returns to the position. */
  readonly syncKey: Accessor<number>;
  readonly onAction: (action: string) => void;
};

/**
 * What the game's board is given, read live: the shared board props, the
 * person's side (`null` while watching) and every seat with its look. The
 * hand, private setup and commitments are the live game's; an earlier
 * position reviewed shows without them.
 */
function useFrameBoardProps(
  model: CustomGameScreenModel,
  review: CustomGameReview,
  state: BoardState
): GameFrameBoardProps {
  const sounds = useSoundsPreference();
  const seats = useFrameBoardSeats(model);
  const simulation = model.simulation;
  const live = (): boolean => review.live();
  return {
    get simulation() {
      return live() && simulation.active() ? simulation.controls() : undefined;
    },
    get position() {
      return state.position();
    },
    get lastAction() {
      return live() && simulation.active() ? null : review.lastAction();
    },
    get orientation() {
      return state.orientation();
    },
    get interactive() {
      return state.interactive();
    },
    get sound() {
      return !sounds.muted();
    },
    get syncKey() {
      return state.syncKey();
    },
    onAction: state.onAction,
    testId: BOARD_TEST_ID,
    get setup() {
      return model.privateSetup.own();
    },
    get hand() {
      return live() ? model.ownHand() : null;
    },
    get committed() {
      return live() ? (model.current()?.committed ?? []) : [];
    },
    get commitment() {
      return live() ? model.ownCommitment() : null;
    },
    get viewer() {
      return model.mySide();
    },
    get seats() {
      return seats();
    },
  };
}

/** Every seat of the game with its look and its holder's name, read live. */
function useFrameBoardSeats(
  model: CustomGameScreenModel
): Accessor<GameFrameBoardProps['seats']> {
  const presentation = useGamePresentation();
  const names = useSeatNames(model);
  return () => {
    const game = model.current();
    if (game === null) return [];
    const frame = presentation(game.fen).frame;
    return game.sides.map((side) => ({
      side,
      look: frame.seats.look(side),
      name: names[side](),
    }));
  };
}

/**
 * Mounts the game's board through its frame (`frame.createBoard`): once per
 * game, with props read live, so the board, its actions and its controls
 * share one session. A refused gesture resets the board to the position.
 */
export function useFrameBoard(
  model: CustomGameScreenModel,
  review: CustomGameReview
): FrameBoard {
  const presentation = useGamePresentation();
  const simulation = model.simulation;
  const [reset, setReset] = createSignal(0);
  const position = createMemo(() =>
    review.live() && simulation.active()
      ? (simulation.position() ?? review.fen())
      : review.fen()
  );
  const interactive = createMemo(() => customGameCanMove(model, review));
  const orientation = createMemo(
    () =>
      frameTable(model.current()?.sides ?? [], model.mySide()).near ?? 'white'
  );
  const props = useFrameBoardProps(model, review, {
    position,
    interactive,
    orientation,
    syncKey: reset,
    onAction: (action) => {
      void model.choose(gestureChoice(model, action)).catch(() => {
        setReset((value) => value + 1);
      });
    },
  });
  const frame = createMemo(() => {
    const game = model.current();
    return game === null ? null : presentation(game.fen).frame;
  });
  const session = createMemo(() => {
    const current = frame();
    return current === null ? null : untrack(() => current.createBoard(props));
  });
  return { session, position, interactive, orientation };
}

/**
 * A board's own actions as an action bar shows them, each `${testId}-${id}`
 * after the board's test id. Matched games use it too.
 */
export function frameActionItems(
  actions: readonly GameFrameAction[],
  testId: string,
  placement: 'before-board' | 'after-board' = 'after-board'
): readonly GameActionItem[] {
  return actions
    .filter((action) => (action.placement ?? 'after-board') === placement)
    .map((action) => ({
      id: action.id,
      label: action.label,
      testId: `${testId}-${action.id}`,
      onPress: action.run,
      disabled: !action.enabled,
      emphasis: action.emphasis,
      pressed: action.pressed,
    }));
}

/** The board the frame mounted and, under it, the board's own controls. */
export function FrameBoardMount(props: { board: FrameBoard }): JSX.Element {
  return (
    <Show when={props.board.session()} keyed>
      {(session) => (
        <>
          <Dynamic component={session.Board} />
          <Show when={session.controls}>
            {(controls) => <Dynamic component={controls()} />}
          </Show>
        </>
      )}
    </Show>
  );
}

const ignoreAction = (): void => undefined;

/**
 * The board as the game's own frame draws it while the game is set up: the
 * starting position facing the viewer's own side (the side they hold, else
 * the first), and nothing on it to press. It carries no private setup, hand
 * or commitment, and its own actions and controls are left out: a preview
 * says which board, not where to play.
 */
export function FramePreviewBoardMount(props: {
  readonly model: CustomGameScreenModel;
  readonly board: FrameBoard;
}): JSX.Element {
  const presentation = useGamePresentation();
  const frame = createMemo(() => {
    const game = props.model.current();
    return game === null ? null : presentation(game.fen).frame;
  });
  const seats = useFrameBoardSeats(props.model);
  const previewProps: GameFrameBoardProps = {
    simulation: undefined,
    get position() {
      return props.model.current()?.fen ?? '';
    },
    lastAction: null,
    get orientation() {
      return props.board.orientation();
    },
    interactive: false,
    sound: false,
    syncKey: 0,
    onAction: ignoreAction,
    testId: BOARD_PREVIEW_TEST_ID,
    setup: null,
    hand: null,
    committed: [],
    commitment: null,
    get viewer() {
      return props.model.mySide();
    },
    get seats() {
      return seats();
    },
  };
  return (
    <Show when={frame()} keyed>
      {(current) => {
        const session = untrack(() => current.createBoard(previewProps));
        return <Dynamic component={session.Board} />;
      }}
    </Show>
  );
}
