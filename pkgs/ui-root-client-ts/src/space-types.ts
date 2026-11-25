/**
 * The data every space screen is drawn from: who is in the space, what the
 * viewer may do, and the game, which is a parameter and never a branch.
 *
 * A space screen (`SpaceShell`, `SpaceLauncher`, `SpaceSetupTemplate`,
 * `SpaceInGameTemplate`) never spells a game's name, art or settings and
 * never asks which game it is: a game fills the slots of a `SpaceGame`.
 */

import type { JSX } from '@solidjs/web';
import type { AvatarSeatColor } from './avatar/index';
import type { IconComponent } from './create-icon/index';
import type { GameOptionFieldProps } from './game-option-field/index';
import type { GameSeatLook } from './game-seat-swatch/index';
import type { GameTileMotif } from './game-tile/index';

/** Who is looking: the host runs the space, a guest plays along. */
export type SpaceRole = 'host' | 'guest';

/** What the space is doing now. */
export type SpacePhase = 'choosing' | 'settingUp' | 'inGame';

/**
 * A person's status, each drawn as its own badge shape on the avatar:
 * `choosing` a grid, `watching` an eye, `settingUp` sliders, `notReady`
 * three dots, `ready` a check, `turn` a play mark, `away` a moon.
 */
export type SpacePersonStatus =
  | 'choosing'
  | 'watching'
  | 'settingUp'
  | 'notReady'
  | 'ready'
  | 'turn'
  | 'away';

/**
 * Who holds a cell in the people row. `remote`: a player who is not in the
 * space (a matchmaking opponent), shown with the people but never one of
 * them: no host actions, no Invite.
 */
export type SpacePersonKind = 'person' | 'bot' | 'openSeat' | 'remote';

/**
 * The one reserved data line under a name: at most one swatch and one
 * short value (tabular figures), with the same fact in words for listeners
 * and the person's menu.
 */
export type SpacePersonData = {
  swatch?: GameSeatLook | undefined;
  /** One short value: `10:00`, `P2`, `42 pts`. */
  value?: string | undefined;
  /** The data in words: `playing Black, 10 minutes on the clock`. */
  description?: string | undefined;
};

/** One cell of the people row: a person, a bot or an open seat. */
export type SpacePerson = {
  /** Stable within the space. */
  id: string;
  kind: SpacePersonKind;
  /** Display name; the viewer's own cell reads "You" instead. */
  name: string;
  /** The viewer's own cell. */
  you?: boolean | undefined;
  /** The space's host: the crown badge, and the accent ring out of game. */
  host?: boolean | undefined;
  status?: SpacePersonStatus | undefined;
  /** The muted badge at the avatar's lower left. */
  muted?: boolean | undefined;
  initials?: string | undefined;
  /** Stable identity that tints an initials face (`Avatar` `tintKey`). */
  tintKey?: string | undefined;
  uri?: string | undefined;
  /**
   * The person's own avatar art as trusted SVG markup (a profile's
   * generated avatar, `Avatar` `svg`); wins over `uri` and initials.
   */
  svg?: string | undefined;
  /** The cell's `data-testid`, for harness bindings. */
  testId?: string | undefined;
};

/**
 * One action a game supplies: on the action bar, or at the top of a
 * person's menu. Labels say what will happen (`Fire at C4`).
 */
export type SpaceGameAction = {
  /** Stable within its list; shipped as `data-action`. */
  id: string;
  label: string;
  /** `primary`: the one action that moves the game forward (one per bar). */
  emphasis?: 'primary' | undefined;
  /** `destructive`: Resign, Surrender, in the destructive tone. */
  tone?: 'default' | 'destructive' | undefined;
  disabled?: boolean | undefined;
  onPress: () => void;
  /** The control's `data-testid`, for harness bindings. */
  testId?: string | undefined;
};

/**
 * One row of a space menu: the space menu behind row 1's button, the
 * action bar's More sheet. Labels say what will happen (`Rename space`).
 */
export type SpaceMenuItem = {
  /** Stable within its menu; shipped as `data-action`. */
  id: string;
  label: string;
  /** The row's picture in the space menu. */
  icon?: IconComponent | undefined;
  tone?: 'default' | 'destructive' | undefined;
  disabled?: boolean | undefined;
  onPress: () => void;
  /** The row's `data-testid`, for harness bindings. */
  testId?: string | undefined;
};

/**
 * How a game ended for the viewer, in place of the live status and
 * actions: `You won`, then Rematch and Back to games.
 */
export type SpaceGameResult = {
  /** The one line that says the outcome: `You won`, `Draw`. */
  status: string;
  /** A quiet note beside it: `by checkmate`. */
  detail?: string | undefined;
  /** What to do next; the first `primary` one leads. */
  actions: readonly SpaceGameAction[];
};

/**
 * A secondary panel the in-game stage opens from its status line: the move
 * list, the game's commands. Its content renders only while it is open.
 */
export type SpaceInGameAside = {
  /** The opener's label and the sheet's title: `Moves`. */
  label: string;
  content: () => JSX.Element;
  /** The opener's `data-testid`. */
  testId?: string | undefined;
};

/** How many people a game takes, and whether bots fill empty seats. */
export type SpaceGamePlayers = {
  /** Every head count the game plays with, ascending: `[2]`, `[2, 4]`, `[1]`. */
  counts: readonly number[];
  bots: boolean;
};

/** In game, what a game shows for one person in the people row. */
export type SpaceGameSeat = {
  /** The player's color: rings their avatar and marks what is theirs on the board. */
  color?: AvatarSeatColor | undefined;
  /** Playing now: the turn badge and the data line in full ink. */
  turn?: boolean | undefined;
  /** The one number that matters: a clock, points, round wins. */
  data?: SpacePersonData | undefined;
};

/** What a game supplies while it is being set up. */
export type SpaceGameSetup = {
  /**
   * The game's settings, one row each: read-only for a guest, the setup
   * control for the host (`GameOptionField`).
   */
  settings: readonly GameOptionFieldProps[];
  /** Per-person setup data: a side and a clock, a rider color and seat. */
  personData?:
    | ((person: SpacePerson) => SpacePersonData | undefined)
    | undefined;
};

/** What a game supplies while it is being played, for this exact moment. */
export type SpaceGamePlay = {
  /** The one slim status line above the board: `Your move`. */
  status: string;
  /** A quiet note beside it: `Chess · move 3`. */
  detail?: string | undefined;
  /** The whole board, edge to edge in the stage. */
  board: JSX.Element;
  /** One to three actions for now; empty shows `waiting` instead. */
  actions: readonly SpaceGameAction[];
  /** What the viewer is waiting for when there is nothing to do. */
  waiting?: string | undefined;
  /** Each person's player color, turn and data line. */
  seat?: ((person: SpacePerson) => SpaceGameSeat | undefined) | undefined;
  /**
   * The game's own actions on a person, put first in their menu: Offer
   * draw and Resign on yourself, Request takeback on your opponent.
   */
  personActions?:
    | ((person: SpacePerson, viewer: SpaceRole) => readonly SpaceGameAction[])
    | undefined;
};

/**
 * A game as data, the parameter of every space template. Never branch on
 * which game this is; a need it cannot express becomes a new slot here.
 */
export type SpaceGame = {
  /** Stable key (test ids); never compared to a game's id. */
  key: string;
  name: string;
  /** The game's tile art (`GameTile`). */
  motif: GameTileMotif;
  /** One line about the game: `Sink the hidden fleet`. */
  tagline: string;
  players: SpaceGamePlayers;
  setup: SpaceGameSetup;
  play?: SpaceGamePlay | undefined;
};
