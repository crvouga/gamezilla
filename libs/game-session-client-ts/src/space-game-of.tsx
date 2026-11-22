/**
 * A game as a space's templates take it (`SpaceGame`), made from the data
 * every game already supplies: its client parts (`title`, `caption`,
 * `tile`), its presentation's frame (`players`, `seats`) and, while it is
 * played, what the session reads of the room. Generic: no game is named
 * and no game describes itself twice.
 *
 * - {@link spaceGameOf}: the whole `SpaceGame`, with `play` while a game
 *   is played.
 * - {@link spaceGamePlay}: `SpaceGame.play` from each seat and the
 *   actions for now. The viewer's standing actions (Offer draw, Resign)
 *   sit on the action bar while it has room beside the live ones, else at
 *   the top of the viewer's own sheet in the people row; requests of an
 *   opponent (a takeback) at the top of each opponent's sheet.
 * - {@link spaceSeatOfFrame}: one seat's look, figure and words as the
 *   game's frame says them in a position.
 * - {@link spaceBoardActions}: the board's own actions for the bar.
 * - {@link spaceGamePeople}: the people row in game: everyone in the
 *   space (watchers marked), then whoever plays without being in it.
 * - {@link spaceSeatColor}: a seat's paint as the avatar ring draws it.
 */

import { t } from '@lingui/core/macro';
import type {
  GameFrame,
  GameFrameAction,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type AvatarSeatColor,
  avatarInitials,
} from '@pkgs/ui-root-client-ts/avatar';
import type {
  GameSeatColor,
  GameSeatLook,
} from '@pkgs/ui-root-client-ts/game-seat-swatch';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import { SPACE_ACTION_BAR_MAX } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type {
  SpaceGame,
  SpaceGameAction,
  SpaceGamePlay,
  SpaceGameSeat,
  SpaceGameSetup,
  SpacePerson,
  SpacePersonKind,
} from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from 'solid-js';
import { frameSwatch } from './game-frame-look';

/** Who the game is, from its client parts (`title`, `caption`, `tile`). */
export type SpaceGameIdentity = {
  /** The game's id: stable, for test ids; never compared to a game. */
  readonly key: string;
  /** Its `title`. */
  readonly name: string;
  /** Its `tile`. */
  readonly motif: GameTileMotif;
  /** Its `caption`. */
  readonly tagline: string;
};

/** Everything a `SpaceGame` is made from beside its play. */
export type SpaceGameSource = SpaceGameIdentity & {
  /** How many it seats: its frame's `players`, or the seats of this game. */
  readonly players: { readonly min: number; readonly max: number };
  /** Bots may fill the seats people leave open. */
  readonly bots: boolean;
  /** While the game is set up; no settings by default. */
  readonly setup?: SpaceGameSetup | undefined;
};

/** One seat while a game is played, as the people row shows it. */
export type SpaceGameSeatSource = {
  readonly side: GameSide;
  /** The people-row id of whoever plays it (`SpacePerson.id`). */
  readonly person: string;
  /** The game's name for the side (`Black`, `Red circle`). */
  readonly sideLabel: string;
  readonly look: GameSeatLook;
  /** Plays now: the turn badge. */
  readonly turn: boolean;
  /** The one number that matters: the running clock, a score, a place. */
  readonly figure: string | null;
  /** The figure's `data-testid`, for harness bindings. */
  readonly figureTestId?: string | undefined;
  /** Everything else said of the seat, in words (`Points 3`, `Out`). */
  readonly words: readonly string[];
};

/** What a game being played shows now, beside its seats. */
export type SpaceGamePlaySource = {
  /** The one status line: `Black to move.`. */
  readonly status: string;
  readonly detail?: string | undefined;
  /** The game's board, made once. */
  readonly board: JSX.Element;
  /** What the viewer waits for when there is nothing to do. */
  readonly waiting?: string | undefined;
  readonly seats: readonly SpaceGameSeatSource[];
  /**
   * What playing needs now: the board's own actions, an answer the game
   * waits for. Always on the bar (past three, its More).
   */
  readonly actions: readonly SpaceGameAction[];
  /**
   * The viewer's standing in the game: Offer draw, Resign, Cancel game. On
   * the bar while it has room beside `actions`; else first in the viewer's
   * own sheet.
   */
  readonly standing: readonly SpaceGameAction[];
  /** Asked of an opponent (Request takeback): first in each one's sheet. */
  readonly ofOpponent?: readonly SpaceGameAction[] | undefined;
};

/** Who plays a seat, for the people row. */
export type SpaceGameHolder = {
  readonly side: GameSide;
  /** A person's profile id, else an id of the seat's own. */
  readonly person: string;
  /** For a player not in the space: a `bot`, else `remote`. */
  readonly kind: SpacePersonKind;
  readonly name: string;
  /** The viewer plays it. */
  readonly you?: boolean | undefined;
  /** Their cell's `data-testid`. */
  readonly testId?: string | undefined;
};

/**
 * Each paint as the avatar ring draws it: a player color as it is, a
 * board's own piece paint as the player color of its place in seat order
 * (the ring has only player colors).
 */
const SEAT_RING: Readonly<Record<GameSeatColor, AvatarSeatColor>> = {
  player1: 'player1',
  player2: 'player2',
  player3: 'player3',
  player4: 'player4',
  player5: 'player5',
  player6: 'player6',
  player7: 'player7',
  player8: 'player8',
  'disc-one': 'player1',
  'disc-two': 'player2',
  'trail-one': 'player1',
  'trail-two': 'player2',
  'trail-three': 'player3',
  'trail-four': 'player4',
  'pawn-one': 'player1',
  'pawn-two': 'player2',
  'pawn-three': 'player3',
  'pawn-four': 'player4',
};

/** A seat's paint as the avatar ring draws it; none for a mark alone. */
export function spaceSeatColor(
  look: GameSeatLook
): AvatarSeatColor | undefined {
  return look.color === undefined ? undefined : SEAT_RING[look.color];
}

/** One seat's look, figure and words, as the game's frame says them. */
export function spaceSeatOfFrame(
  seats: GameFrame<unknown>['seats'],
  at: {
    readonly position: string;
    readonly side: GameSide;
    readonly committed: readonly GameSide[];
  }
): Pick<SpaceGameSeatSource, 'look' | 'figure' | 'words'> {
  const stat = seats.stat(at.position, at.side);
  return {
    look: frameSwatch(seats.look(at.side)),
    figure: stat?.value ?? null,
    words: [
      ...(stat === null ? [] : [`${stat.label} ${stat.value}`]),
      ...seats.facts(at.position, at.side, at.committed),
      ...(seats.out(at.position, at.side) ? [t`Out`] : []),
    ],
  };
}

/**
 * A board's own actions (`GameFrameBoardSession.actions`) for the action
 * bar, each `${testId}-${id}`: a required choice that leads the board
 * first, then the rest in the board's order.
 */
export function spaceBoardActions(
  actions: readonly GameFrameAction[],
  testId: string
): readonly SpaceGameAction[] {
  const leads = (action: GameFrameAction): boolean =>
    action.placement === 'before-board';
  return [
    ...actions.filter(leads),
    ...actions.filter((action) => !leads(action)),
  ].map((action) => ({
    id: `board-${action.id}`,
    label: action.label,
    emphasis: action.emphasis,
    disabled: !action.enabled,
    onPress: action.run,
    testId: `${testId}-${action.id}`,
  }));
}

function seatOf(seat: SpaceGameSeatSource): SpaceGameSeat {
  return {
    color: spaceSeatColor(seat.look),
    turn: seat.turn,
    data: {
      swatch: seat.look,
      value: seat.figure ?? undefined,
      description: [t`playing ${seat.sideLabel}`, ...seat.words].join(', '),
      testId: seat.figureTestId,
    },
  };
}

/** `SpaceGame.play` for this moment, from each seat and the actions for now. */
export function spaceGamePlay(source: SpaceGamePlaySource): SpaceGamePlay {
  const fits =
    source.actions.length + source.standing.length <= SPACE_ACTION_BAR_MAX;
  const own = fits ? [] : source.standing;
  return {
    status: source.status,
    detail: source.detail,
    board: source.board,
    waiting: source.waiting,
    actions: fits ? [...source.actions, ...source.standing] : source.actions,
    seat: (person) => {
      const held = source.seats.filter((seat) => seat.person === person.id);
      const shown = held.find((seat) => seat.turn) ?? held[0];
      return shown === undefined ? undefined : seatOf(shown);
    },
    personActions: (person) => {
      if (person.you === true) return own;
      return source.seats.some((seat) => seat.person === person.id)
        ? (source.ofOpponent ?? [])
        : [];
    },
  };
}

/** Every head count from `min` to `max`. */
function counts(players: SpaceGameSource['players']): readonly number[] {
  return Array.from(
    { length: players.max - players.min + 1 },
    (_, index) => players.min + index
  );
}

/** The game as the space's templates take it; `play` while it is played. */
export function spaceGameOf(
  source: SpaceGameSource,
  play?: SpaceGamePlaySource
): SpaceGame {
  return {
    key: source.key,
    name: source.name,
    motif: source.motif,
    tagline: source.tagline,
    players: { counts: counts(source.players), bots: source.bots },
    setup: source.setup ?? { settings: [] },
    play: play === undefined ? undefined : spaceGamePlay(play),
  };
}

/**
 * The people row while a game is played: everyone in the space, a person
 * who plays nothing marked watching, then each player who is not in the
 * space (a bot, a guest on this device, someone gone) in a cell of their
 * own. Each player's cell carries their seat's test id; the viewer's own,
 * when they play nothing, `viewerTestId`.
 */
export function spaceGamePeople(
  people: readonly SpacePerson[],
  holders: readonly SpaceGameHolder[],
  viewerTestId?: string | undefined
): readonly SpacePerson[] {
  const present = people.map((person): SpacePerson => {
    const holder = holders.find((each) => each.person === person.id);
    if (holder !== undefined) return { ...person, testId: holder.testId };
    return {
      ...person,
      status: person.status === 'away' ? 'away' : 'watching',
      testId: person.you === true ? viewerTestId : person.testId,
    };
  });
  const absent = holders.filter(
    (holder, index) =>
      !people.some((person) => person.id === holder.person) &&
      holders.findIndex((each) => each.person === holder.person) === index
  );
  return [
    ...present,
    ...absent.map((holder): SpacePerson => {
      const initials = avatarInitials(holder.name);
      return {
        id: holder.person,
        kind: holder.kind,
        name: holder.name,
        you: holder.you,
        initials: initials.length > 0 ? initials : undefined,
        tintKey: holder.person,
        testId: holder.testId,
      };
    }),
  ];
}
