/**
 * Story-only: a game's board inside the real game frame
 * (`GameFrameScreenView`), so every game's board stories show the screen a
 * person plays on — the title and facts, the seats around the board, the
 * play actions, the record and the result — exactly as the frame's own
 * stories do. A game supplies only its presentation; the frame data is read
 * from it as the app reads it. Production never imports this module.
 */
import {
  AVERY,
  JORDAN,
  MORGAN,
  ROBIN,
} from '@libs/spaces-client-ts/spaces-story.example';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  GameBoardProps,
  GamePresentation,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import type {
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { type JSX, mergeProps, Show, untrack } from 'solid-js';
import { fn } from 'storybook/test';
import { CUSTOM_GAME_PLACES } from './custom-game-places';
import { FrameStory } from './game-frame-board.example';
import { FRAME_NO_NEXT, FRAME_NO_PLAY } from './game-frame-empty';
import { frameSwatch } from './game-frame-look';
import { frameActionItems } from './game-frame-play';
import { frameArgs, PEOPLE, record } from './game-frame-story.example';
import type {
  FrameClock,
  FrameConnection,
  FramePhase,
  FramePlaySeat,
  FrameRecord,
  FrameResult,
  FrameStatus,
  FrameTable,
} from './game-frame-view-types';

/** How a game's stories hand over its presentation. */
export type GameTablePresentation = Omit<GamePresentation<JSX.Element>, 'id'>;

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
 * What a story says about the game around its board, with
 * `parameters: { table: GameTableStory }`.
 */
export type GameTableStory = {
  /** The game's title above the board, as its menu names it; defaults to the presentation's name. */
  readonly title?: string;
  /** A refused action, shown through the production frame's recovery notice. */
  readonly error?: string;
  /** The person's own seat; `null` for a watcher. Defaults to the board's orientation. */
  readonly viewer?: GameSide | null;
  /** The side to move. */
  readonly turn?: GameSide | null;
  /** How a finished game ended. */
  readonly ending?:
    | {
        readonly winner: GameWinner;
        readonly reason: string;
      }
    | undefined;
  /** The moves played to reach the position, as the game writes them. */
  readonly moves?: readonly string[];
  /**
   * `false` for a game played in real time: it has no turns, so its record
   * lists no moves, as the app shows it. Defaults to `true`.
   */
  readonly turns?: boolean;
  /**
   * `false` for a game whose rules, not a fixed rotation, say who plays next
   * (a hand game such as Hearts): the app then names no seat beside a move.
   * Defaults to `true`.
   */
  readonly seatedMoves?: boolean;
  /**
   * The viewer's own choice is being sent, as the app's frame shows it while
   * `model.submitting()`: the line says so and the viewer's seat stops
   * deciding. Defaults to `false`.
   */
  readonly sending?: boolean;
  /** A timed game: the agreed control and each seat's clock as it reads now. */
  readonly timed?:
    | {
        readonly minutes: number;
        readonly increment: number;
        readonly clocks: Readonly<Partial<Record<GameSide, string>>>;
      }
    | undefined;
  /** The connection as the frame shows it; defaults to `online`. */
  readonly connection?: FrameConnection | undefined;
};

/** Who holds each side: the space stories' people, Avery first. */
const HOLDERS = {
  white: { id: PEOPLE.avery, name: AVERY.name },
  black: { id: PEOPLE.jordan, name: JORDAN.name },
  red: { id: PEOPLE.morgan, name: MORGAN.name },
  blue: { id: PEOPLE.robin, name: ROBIN.name },
} as const satisfies Record<GameSide, { id: string; name: string }>;

type TableProps = GameTableStory & {
  readonly presentation: GameTablePresentation;
  readonly sides: readonly GameSide[];
  readonly board: GameBoardProps;
};

function viewerOf(props: TableProps): GameSide | null {
  return props.viewer === undefined ? props.board.orientation : props.viewer;
}

/** A timed seat's clock, running for the side to move until the game ends. */
function seatClock(props: TableProps, side: GameSide): FrameClock | null {
  const value = props.timed?.clocks[side];
  if (value === undefined) return null;
  return { value, active: props.ending === undefined && side === props.turn };
}

/** One seat at the table, read from the game's frame as the app reads it. */
function playSeat(props: TableProps, side: GameSide): FramePlaySeat {
  const seats = props.presentation.frame.seats;
  const position = props.board.position;
  return {
    side,
    sideLabel: props.presentation.sideLabel(side),
    holder: { kind: 'person', person: HOLDERS[side].id },
    plainName: HOLDERS[side].name,
    swatch: frameSwatch(seats.look(side)),
    clock: seatClock(props, side),
    stat: seats.stat(position, side),
    state: seats.out(position, side) ? { kind: 'out', label: 'Out' } : null,
    standIn: false,
    committed: props.board.committed.includes(side),
    choosing: false,
    facts: seats.facts(position, side, props.board.committed),
    deciding:
      props.ending === undefined &&
      side === props.turn &&
      !(props.sending === true && side === viewerOf(props)),
    reclaim: false,
  };
}

/** The one line about the game: the game's own words, else `<Side> to move.` */
function tableStatus(props: TableProps): FrameStatus {
  const viewer = viewerOf(props);
  const own = props.presentation.frame.turnStatus(
    props.board.position,
    viewer,
    props.board.committed,
    (side) => HOLDERS[side].name
  );
  const turn = props.turn ?? null;
  const ending = props.ending;
  const description =
    ending === undefined
      ? (own ??
        (turn === null ? '' : `${props.presentation.sideLabel(turn)} to move.`))
      : (props.presentation.endingDescription(ending.reason) ?? '');
  return {
    lineup: props.sides
      .map(
        (side) =>
          `${props.presentation.sideLabel(side)}: ${HOLDERS[side].name}.`
      )
      .join(' '),
    description,
    plainTurn: ending === undefined && own === null && turn !== null,
    emphasis:
      ending === undefined && turn === viewer && props.sending !== true
        ? 'yours'
        : 'neutral',
    tone: 'neutral',
    sending: props.sending === true || props.connection === 'waiting',
    minutes: props.timed?.minutes ?? 0,
    increment: props.timed?.increment ?? 0,
  };
}

function tableResult(
  props: TableProps,
  ending: NonNullable<GameTableStory['ending']>
): FrameResult {
  const viewer = viewerOf(props);
  const summary = props.presentation.frame.result(
    props.board.position,
    ending.winner
  );
  const winners = summary.standings
    .filter((standing) => standing.place === 1)
    .map((standing) => standing.side);
  const names = winners.map((side) => HOLDERS[side].name).join(' and ');
  const headline = (): string => {
    if (winners.length === props.sides.length) return 'Draw';
    if (viewer !== null && winners.includes(viewer)) return 'You win';
    return `${names} ${winners.length === 1 ? 'wins' : 'win'}`;
  };
  return {
    headline: headline(),
    note: null,
    scoreLabel: summary.scoreLabel,
    standings: summary.standings.map((standing) => ({
      id: standing.side,
      place: standing.place,
      name: HOLDERS[standing.side].name,
      holder: { kind: 'person', person: HOLDERS[standing.side].id },
      score: standing.score,
      you: standing.side === viewer,
      testId: `custom-game-standing-${standing.side}`,
      readiness: null,
    })),
  };
}

/** The moves so far, each behind the swatch of the seat that made it. */
function tableRecord(props: TableProps): FrameRecord {
  const moves = props.moves ?? [];
  const movers = props.sides.map((side) => ({
    sideLabel: props.presentation.sideLabel(side),
    swatch: frameSwatch(props.presentation.frame.seats.look(side)),
  }));
  return {
    ...record(moves),
    turns: props.turns ?? true,
    moveHeading: props.presentation.moveHeading?.() ?? '',
    firstTurnSample: props.presentation.frame.firstTurnSample?.map(
      (sample) => ({ label: sample.label, swatch: frameSwatch(sample.look) })
    ),
    outline: props.presentation.frame.outline?.(props.board.position) ?? [],
    perTurn: props.seatedMoves === false ? 1 : movers.length,
    movers: moves.flatMap((_, index) => {
      if (props.seatedMoves === false) return [];
      const mover = movers[index % movers.length];
      return mover === undefined ? [] : [mover];
    }),
  };
}

/** How the frame seats the players: as the game's own frame says. */
function tableShape(props: TableProps): FrameTable['shape'] {
  if (props.presentation.frame.boardSeats === true) return 'board';
  return props.sides.length > 2 ? 'rail' : 'strip';
}

function GameFrameTable(props: TableProps): JSX.Element {
  const viewer = (): GameSide | null => viewerOf(props);
  // The board session is made once, as the frame makes it when it mounts.
  const session = untrack(() => {
    const board: GameFrameBoardProps = mergeProps(props.board, {
      get viewer() {
        return viewer();
      },
      get seats() {
        return props.sides.map((side) => ({
          side,
          look: props.presentation.frame.seats.look(side),
          name: HOLDERS[side].name,
        }));
      },
    });
    return props.presentation.frame.createBoard(board);
  });
  const near = (): GameSide => viewer() ?? props.board.orientation;
  const over = (): boolean => props.ending !== undefined;
  const seated = (): boolean => viewer() !== null && !over();
  const phase = (): FramePhase => (over() ? 'completed' : 'active');
  return (
    <FrameStory
      {...frameArgs()}
      place={CUSTOM_GAME_PLACES.home[phase()]}
      title={props.title ?? props.presentation.name()}
      error={props.error ?? ''}
      boardFit={props.presentation.frame.boardFit}
      boardAlign={props.presentation.frame.boardAlign}
      connection={props.connection ?? 'online'}
      phase={phase()}
      viewerSide={viewer()}
      status={tableStatus(props)}
      table={{
        shape: tableShape(props),
        named: props.presentation.frame.boardNames === true,
        seatLayout: props.presentation.frame.seatLayout,
        compactInset: props.presentation.frame.compactInset,
        near: playSeat(props, near()),
        others: props.sides
          .filter((side) => side !== near())
          .map((side) => playSeat(props, side)),
      }}
      play={{
        ...FRAME_NO_PLAY,
        canOfferDraw: seated() && props.presentation.frame.drawOffers,
        canResign: seated(),
        boardActions: frameActionItems(session.actions(), props.board.testId),
        leadingBoardActions: frameActionItems(
          session.actions(),
          props.board.testId,
          'before-board'
        ),
      }}
      result={
        props.ending === undefined ? null : tableResult(props, props.ending)
      }
      next={
        over()
          ? { plays: viewer() !== null, canCreate: true, reviewable: true }
          : FRAME_NO_NEXT
      }
      record={tableRecord(props)}
      board={
        <>
          <session.Board />
          <Show when={session.controls}>{(controls) => controls()()}</Show>
        </>
      }
    />
  );
}

/**
 * What a game's board story renders: its board, given by the story's
 * args, in the game frame; the story says who is looking, whose turn it
 * is, the moves so far and how the game ended with
 * `parameters: { table: GameTableStory }`.
 */
export function renderGameTable(
  presentation: GameTablePresentation,
  sides: readonly GameSide[],
  args: GameBoardProps,
  context: { readonly parameters: Readonly<Record<string, unknown>> }
): JSX.Element {
  const table = (context.parameters['table'] ?? {}) as GameTableStory;
  return (
    <GameFrameTable
      presentation={presentation}
      sides={sides}
      board={args}
      {...table}
    />
  );
}
