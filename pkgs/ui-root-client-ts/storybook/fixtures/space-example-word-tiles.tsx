/** @jsxImportSource @solidjs/web */

import type { AvatarSeatColor } from '@pkgs/ui-root-client-ts/avatar';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGameSeat,
  SpacePerson,
  SpaceRole,
} from '@pkgs/ui-root-client-ts/space-types';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileRack, type TileRackTile } from '@pkgs/ui-root-client-ts/tile-rack';
import {
  WordTileBoard,
  type WordTileBoardCell,
  type WordTileSquare,
} from '@pkgs/ui-root-client-ts/word-tile-board';
import { WordTileWorkspace } from '@pkgs/ui-root-client-ts/word-tile-workbench';
import type { JSX } from '@solidjs/web';

/**
 * Which moment of a Word Tiles game the example shows: the viewer's turn
 * with ROTE placed but not yet played, or the opponent's turn right after
 * the viewer played it.
 */
export type SpaceExampleWordTilesMoment = 'tilesPlaced' | 'waiting';

export type SpaceExampleWordTilesOptions = {
  /** Defaults to `tilesPlaced`. */
  moment?: SpaceExampleWordTilesMoment | undefined;
  /**
   * Who is looking: a guest sees the settings as text. The viewer is `bob`
   * when hosting and `you` as a guest. Defaults to `guest`.
   */
  role?: SpaceRole | undefined;
  /** Called with the action's id whenever any action is pressed. */
  onAction?: ((id: string) => void) | undefined;
};

const SIZE = 11;
const COLUMNS = 'abcdefghijk'.split('');
const ROWS = Array.from({ length: SIZE }, (_, n) => String(n + 1));

const LETTER_POINTS: Readonly<Record<string, number>> = {
  A: 1,
  D: 2,
  E: 1,
  I: 1,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  R: 1,
  S: 1,
  T: 1,
  Y: 4,
};

const SQUARE_TEXT: Readonly<Record<WordTileSquare, string>> = {
  DL: '2L',
  TL: '3L',
  DW: '2W',
  TW: '3W',
  start: '★',
};

/** Bonus squares keyed `row,column`, zero-based. */
const SQUARES: Readonly<Record<string, WordTileSquare>> = {
  '0,0': 'TW',
  '0,10': 'TW',
  '10,0': 'TW',
  '10,10': 'TW',
  '0,5': 'DW',
  '5,0': 'DW',
  '10,5': 'DW',
  '5,10': 'DW',
  '5,5': 'start',
  '2,2': 'DL',
  '2,8': 'DL',
  '8,8': 'DL',
  '6,6': 'DL',
  '3,6': 'TL',
  '7,7': 'TL',
  '3,1': 'TL',
  '9,3': 'TL',
};

type Placement = {
  word: string;
  row: number;
  column: number;
  down: boolean;
};

/** Committed words, in play order: PLAYER (bob), ARENA (you), TREND (bob). */
const PLAYED: readonly Placement[] = [
  { word: 'PLAYER', row: 5, column: 2, down: false },
  { word: 'ARENA', row: 5, column: 4, down: true },
  { word: 'TREND', row: 8, column: 1, down: false },
];

/** The viewer's word: O, T and E hang down from PLAYER's R; 1 + 1 + 3 + 1 = 6. */
const ROTE: Placement = { word: 'ROTE', row: 5, column: 7, down: true };

const RACK_LETTERS = 'STORMEI'.split('');
/** Rack slots whose tiles spell ROTE's O, T and E. */
const ROTE_SLOTS: ReadonlySet<number> = new Set([2, 1, 5]);

type Tile = { letter: string; state: 'committed' | 'tentative' | 'recent' };

function lay(
  board: Map<string, Tile>,
  placement: Placement,
  state: Tile['state']
): void {
  for (let n = 0; n < placement.word.length; n += 1) {
    const row = placement.row + (placement.down ? n : 0);
    const column = placement.column + (placement.down ? 0 : n);
    const key = `${row},${column}`;
    const letter = placement.word[n];
    if (letter !== undefined && !board.has(key))
      board.set(key, { letter, state });
  }
}

/** Every tile on the board for a moment, keyed `row,column`. */
function tilesFor(moment: SpaceExampleWordTilesMoment): Map<string, Tile> {
  const board = new Map<string, Tile>();
  const last = moment === 'tilesPlaced' ? PLAYED.length - 1 : -1;
  PLAYED.forEach((placement, n) =>
    lay(board, placement, n === last ? 'recent' : 'committed')
  );
  lay(board, ROTE, moment === 'tilesPlaced' ? 'tentative' : 'recent');
  return board;
}

const STATE_WORDS: Readonly<Record<Tile['state'], string>> = {
  committed: '',
  tentative: ', placed this turn',
  recent: ', last word',
};

function cellOf(
  index: number,
  tiles: ReadonlyMap<string, Tile>,
  myTurn: boolean
): WordTileBoardCell {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const id = `${COLUMNS[column]}${ROWS[row]}`;
  const square = SQUARES[`${row},${column}`] ?? null;
  const tile = tiles.get(`${row},${column}`);
  if (tile === undefined) {
    const printed = square === null ? '' : `${SQUARE_TEXT[square]}, `;
    return {
      id,
      letter: '',
      points: null,
      square,
      state: 'empty',
      label: `${printed}${id}, empty`,
      enabled: myTurn,
    };
  }
  const points = LETTER_POINTS[tile.letter] ?? 0;
  return {
    id,
    letter: tile.letter,
    points,
    square,
    state: tile.state,
    label: `${tile.letter} ${points}, ${id}${STATE_WORDS[tile.state]}`,
    enabled: myTurn && tile.state === 'tentative',
  };
}

function rackFor(moment: SpaceExampleWordTilesMoment): readonly TileRackTile[] {
  const placed = moment === 'tilesPlaced';
  return RACK_LETTERS.map((letter, n) => {
    const points = LETTER_POINTS[letter] ?? 0;
    const onBoard = placed && ROTE_SLOTS.has(n);
    return {
      id: String(n),
      letter,
      points,
      selected: false,
      placed: onBoard,
      label: `${letter}, ${points} ${points === 1 ? 'point' : 'points'}${onBoard ? ', on the board' : ''}`,
      enabled: placed,
    };
  });
}

/** The shared board with the viewer's own rack beside it. */
function WordTilesExampleBoard(props: {
  moment: SpaceExampleWordTilesMoment;
}): JSX.Element {
  const myTurn = props.moment === 'tilesPlaced';
  const tiles = tilesFor(props.moment);
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) =>
    cellOf(index, tiles, myTurn)
  );
  return (
    <WordTileWorkspace
      rack={
        <TileRack
          label="Your rack"
          testId="space-word-tiles-rack"
          tiles={rackFor(props.moment)}
          onActivate={() => undefined}
        />
      }
      feedback={
        <P role="status" tone="secondary">
          {myTurn ? 'This move: 6 pts' : 'Waiting for bob'}
        </P>
      }
      board={
        <WordTileBoard
          label="Word Tiles board"
          testId="space-word-tiles-board"
          measure="compact"
          columnLabels={COLUMNS}
          rowLabels={ROWS}
          cells={cells}
          squareText={(square) => SQUARE_TEXT[square]}
          onActivate={() => undefined}
        />
      }
    />
  );
}

/**
 * The two story people by id: `bob` (named bob) and `you` (named ana). The
 * viewer is `bob` when hosting and `you` as a guest; the other is the
 * opponent. Every lookup keys by `person.id`, never by the `you` / `host`
 * flags.
 */
type Cast = { viewer: string; opponent: string; opponentName: string };

function castFor(role: SpaceRole): Cast {
  return role === 'host'
    ? { viewer: 'bob', opponent: 'you', opponentName: 'ana' }
    : { viewer: 'you', opponent: 'bob', opponentName: 'bob' };
}

type SeatFacts = { color: AvatarSeatColor; before: number; after: number };

/** Points before ROTE, and after it. */
const VIEWER_SEAT: SeatFacts = { color: 'player2', before: 7, after: 13 };
const OPPONENT_SEAT: SeatFacts = { color: 'player1', before: 24, after: 24 };

function seatFor(
  person: SpacePerson,
  moment: SpaceExampleWordTilesMoment,
  cast: Cast
): SpaceGameSeat | undefined {
  const viewerTurn = moment === 'tilesPlaced';
  const seats: Readonly<Record<string, SeatFacts & { turn: boolean }>> = {
    [cast.viewer]: { ...VIEWER_SEAT, turn: viewerTurn },
    [cast.opponent]: { ...OPPONENT_SEAT, turn: !viewerTurn },
  };
  const seat = seats[person.id];
  if (seat === undefined) return undefined;
  const points = viewerTurn ? seat.before : seat.after;
  return {
    color: seat.color,
    turn: seat.turn,
    data: { value: `${points} pts`, description: `${points} points` },
  };
}

type ActionPress = (id: string) => void;

function action(
  id: string,
  label: string,
  press: ActionPress,
  emphasis?: 'primary'
): SpaceGameAction {
  return { id, label, emphasis, onPress: () => press(id) };
}

/**
 * On the viewer's turn: Swap and pass on the viewer, and a challenge on the
 * opponent, who played the last word (TREND). Nothing while waiting.
 */
function personActionsFor(
  person: SpacePerson,
  moment: SpaceExampleWordTilesMoment,
  cast: Cast,
  press: ActionPress
): readonly SpaceGameAction[] {
  if (moment !== 'tilesPlaced') return [];
  if (person.id === cast.viewer)
    return [
      action('swapTiles', 'Swap tiles', press),
      action('passTurn', 'Pass turn', press),
    ];
  if (person.id === cast.opponent)
    return [action('challengeLastWord', 'Challenge last word', press)];
  return [];
}

/**
 * Word Tiles as a `SpaceGame`: 2 to 4 players on a shared board, each with
 * a private rack. Deterministic: the same moment always draws the same
 * board, rack, scores and actions.
 */
export function spaceExampleWordTiles(
  options: SpaceExampleWordTilesOptions = {}
): SpaceGame {
  const moment = options.moment ?? 'tilesPlaced';
  const role = options.role ?? 'guest';
  const readOnly = role === 'guest';
  const cast = castFor(role);
  const press: ActionPress = (id) => options.onAction?.(id);
  const myTurn = moment === 'tilesPlaced';
  return {
    key: 'word-tiles',
    name: 'Word Tiles',
    motif: 'letters',
    tagline: 'Build crossing words for points',
    players: { counts: [2, 3, 4], bots: false },
    setup: {
      settings: [
        {
          kind: 'choice',
          label: 'Players',
          readOnly,
          testId: 'space-word-tiles-players',
          value: '2',
          options: [
            { value: '2', label: '2 · up to 4' },
            { value: '3', label: '3 · up to 4' },
            { value: '4', label: '4 · up to 4' },
          ],
          onChange: (value) => press(`players:${value}`),
        },
        {
          kind: 'choice',
          label: 'Turn timer',
          readOnly,
          testId: 'space-word-tiles-turn-timer',
          value: 'off',
          options: [
            { value: 'off', label: 'Off' },
            { value: '1m', label: '1 min' },
            { value: '2m', label: '2 min' },
          ],
          onChange: (value) => press(`turnTimer:${value}`),
        },
      ],
    },
    play: {
      status: myTurn ? 'Your turn' : `${cast.opponentName}’s turn`,
      detail: 'Word Tiles · turn 4',
      // Drawn when the template reads it, inside its render root.
      get board(): JSX.Element {
        return <WordTilesExampleBoard moment={moment} />;
      },
      actions: myTurn
        ? [
            action('recall', 'Recall', press),
            action('play', 'Play · 6 pts', press, 'primary'),
          ]
        : [],
      waiting: myTurn ? undefined : `${cast.opponentName} is thinking`,
      seat: (person) => seatFor(person, moment, cast),
      personActions: (person) => personActionsFor(person, moment, cast, press),
    },
  };
}
