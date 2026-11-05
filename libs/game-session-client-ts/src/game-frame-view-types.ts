import type { GameOptionGroup } from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameActionItem } from '@pkgs/ui-root-client-ts/game-action-bar';
import type {
  GamePlayerState,
  GameSeatStat,
} from '@pkgs/ui-root-client-ts/game-player-parts';
import type { GameSeatLook } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import type {
  GameTurnPillEmphasis,
  GameTurnPillTone,
} from '@pkgs/ui-root-client-ts/game-turn-pill';
import type { JSX } from 'solid-js';
import type { FrameStartReason } from './game-frame-start-reason';

/**
 * The game frame as plain data: every game's custom game is shown in this
 * one frame, and only the board (a `JSX.Element` slot) is the game's own.
 * Containers read the room, permissions and the game's presentation and
 * hand the frame these values; stories hand it fixtures.
 */

/** Where the game stands: none yet, set up, played, over or called off. */
export type FramePhase =
  | 'none'
  | 'configuring'
  | 'active'
  | 'completed'
  | 'cancelled';

/** Who holds a seat. A person is named by id; the frame asks `people` for them. */
export type FrameHolder =
  | { readonly kind: 'person' | 'invitation'; readonly person: string }
  | { readonly kind: 'bot'; readonly level?: BotDifficulty | undefined }
  | { readonly kind: 'local' | 'open' | 'closed' };

/**
 * How the frame shows a person it knows only by id: the app passes the
 * live username and picture; without them (stories) the frame uses the
 * plain name and initials.
 */
export type FramePeople = {
  /** `bold` names the person in bold body text. */
  readonly name?: ((person: string, bold?: boolean) => JSX.Element) | undefined;
  readonly avatar?: ((person: string, size: number) => JSX.Element) | undefined;
};

/** A seat's clock as it reads now (`4:59`); whether it is running. */
export type FrameClock = { readonly value: string; readonly active: boolean };

/** One seat as every part of the frame draws it. */
export type FrameSeat = {
  readonly side: GameSide;
  /** The game's name for the side ("Red circle"). */
  readonly sideLabel: string;
  readonly holder: FrameHolder;
  /** Plain words for whoever holds it, as a chip or a listener reads it. */
  readonly plainName: string;
  readonly swatch: GameSeatLook;
  /** `null` for an untimed game. */
  readonly clock: FrameClock | null;
};

/** A seat while the game is played: its state, facts and figure. */
export type FramePlaySeat = FrameSeat & {
  /** The game's own figure for the seat (a score), if it has one. */
  readonly stat: GameSeatStat | null;
  readonly state: GamePlayerState | null;
  readonly standIn: boolean;
  readonly committed: boolean;
  readonly choosing: boolean;
  /** The game's own public facts about the seat. */
  readonly facts: readonly string[];
  /** Its turn, or its secret choice still open. */
  readonly deciding: boolean;
  /** The viewer may take their side back from a stand-in bot. */
  readonly reclaim: boolean;
  /** Opens the holder's profile; `undefined` when tapping does nothing. */
  readonly onPress?: (() => void) | undefined;
};

/** The seats around the board once the game is played. */
export type FrameTable = {
  /**
   * `board`: the game's board seats every player at its own table, and the
   * frame lends it each player (`GameFrame.boardSeats`).
   */
  readonly shape: 'strip' | 'rail' | 'none' | 'board';
  readonly near: FramePlaySeat | null;
  readonly others: readonly FramePlaySeat[];
};

/** A member of the space the host may invite to a seat. */
export type FrameInvitee = {
  readonly person: string;
  readonly plainName: string;
  /** Already holds a seat in this game. */
  readonly disabled: boolean;
};

/** What the host may put in a seat, behind its "Change". */
export type FrameSeatChoices = {
  readonly localPlayers: boolean;
  readonly bots: boolean;
  /** The bot levels to offer; empty unless a bot holds the seat. */
  readonly difficulties: readonly BotDifficulty[];
  readonly difficulty: BotDifficulty | undefined;
  /** Space members to invite; `null` when the host may not invite. */
  readonly invitees: readonly FrameInvitee[] | null;
};

/** An invitation waiting on a seat. */
export type FrameInvitation = {
  /** It is the viewer's own to answer. */
  readonly mine: boolean;
  /** Who invited: the game's creator. */
  readonly inviter: string;
  readonly inviterName: string;
  readonly canAnswer: boolean;
  readonly canRevoke: boolean;
};

/** A seat while the game is set up, with its choices. */
export type FrameSetupSeat = FrameSeat & {
  readonly host: boolean;
  /** The viewer's own seat at someone else's table. */
  readonly visiting: boolean;
  /** The viewer's own seat, at their table or someone else's. */
  readonly own: boolean;
  /** Its holder is ready: a ready person, or a bot or a guest here (always). */
  readonly ready: boolean;
  readonly invitation: FrameInvitation | null;
  readonly canSit: boolean;
  readonly canLeave: boolean;
  /** `null` when the viewer may not change who sits here. */
  readonly choices: FrameSeatChoices | null;
};

/** The game's options while it is set up. */
export type FrameOptions = {
  /** The seat count, for a game offered for several. */
  readonly players: {
    readonly count: number;
    readonly min: number;
    readonly max: number;
  } | null;
  readonly groups: readonly GameOptionGroup[];
  /** The position the options read from. */
  readonly position: string;
  readonly editable: boolean;
  /** The agreed clock, for a host of a game played by turns. */
  readonly clock: {
    readonly minutes: number;
    readonly increment: number;
  } | null;
};

/** Starting the game: why not yet, the viewer's readiness, Start. */
export type FrameStart = {
  readonly reason: FrameStartReason | null;
  /** A seated guest who may not start waits for the host. */
  readonly hostStarts: boolean;
  /** The viewer's own readiness; `null` when they hold no seat. */
  readonly readiness: {
    readonly ready: boolean;
    /** Their private setup is incomplete. */
    readonly blocked: boolean;
  } | null;
  readonly canStart: boolean;
};

/** Everything shown while the game is set up. */
export type FrameSetup = {
  readonly viewerNotice: string | null;
  /** The open seat a member may take at once. */
  readonly takeSeat: GameSide | null;
  readonly seats: readonly FrameSetupSeat[];
  /** The viewer's own private setup; its board is the `setupBoard` slot. */
  readonly privateSetup: {
    readonly complete: boolean;
    readonly locked: boolean;
  } | null;
  readonly options: FrameOptions | null;
  readonly start: FrameStart;
};

/** The one line about where the game stands. */
export type FrameStatus = {
  /** Who holds every seat, for a listener who cannot see the seats. */
  readonly lineup: string;
  readonly description: string;
  /**
   * The line only says which side moves (`<Side> to move.`), which the
   * seat to move already says: no game's own words, stand-in or phase.
   */
  readonly plainTurn: boolean;
  readonly emphasis: GameTurnPillEmphasis;
  readonly tone: GameTurnPillTone;
  readonly sending: boolean;
  readonly minutes: number;
  readonly increment: number;
};

/** The connection, as the offline notice words it. */
export type FrameConnection =
  | 'online'
  /** Offline, but a local game can continue. */
  | 'offline-local'
  /** Offline, and the game needs the connection. */
  | 'needed'
  /** A move made offline waits for the connection. */
  | 'waiting';

/** What a participant is told and may do while the game is played. */
export type FramePlay = {
  readonly drawOffered: boolean;
  /** The other participant, when a person who is away. */
  readonly away: {
    readonly person: string;
    readonly plainName: string;
    readonly twoSided: boolean;
  } | null;
  readonly offerAgainLater: boolean;
  readonly canOfferDraw: boolean;
  readonly canAnswerDraw: boolean;
  readonly canClaimWin: boolean;
  readonly canResign: boolean;
  readonly canCancel: boolean;
  /** The board's own actions (`custom-game-board-${id}`). */
  readonly boardActions: readonly GameActionItem[];
};

/** One player's finish. */
export type FrameStanding = {
  readonly id: GameSide;
  readonly place: number;
  readonly name: string;
  readonly holder: FrameHolder;
  readonly score: string | null;
  readonly you: boolean;
  readonly testId: string;
  readonly readiness: {
    readonly label: string;
    readonly ready: boolean;
  } | null;
};

/** The game-over result under the final board. */
export type FrameResult = {
  readonly headline: string;
  readonly note: string | null;
  readonly scoreLabel: string | null;
  readonly standings: readonly FrameStanding[];
};

/** What comes next once the game is over. */
export type FrameNext = {
  /** Played it, or may set up the next one. */
  readonly plays: boolean;
  readonly canCreate: boolean;
  readonly reviewable: boolean;
};

/** The game's record beside the board. */
/** Who made a move, as their seat looks in the record. */
export type FrameMover = Pick<FrameSeat, 'sideLabel' | 'swatch'>;

export type FrameRecord = {
  /** Ids of this space's earlier games, newest first. */
  readonly earlier: readonly string[];
  /** `live` or an earlier game's id. */
  readonly selection: string;
  /** The game is played by turns, so its moves can be stepped through. */
  readonly turns: boolean;
  /** Every move of the shown game, as its notation. */
  readonly moves: readonly string[];
  /**
   * Moves per numbered turn: the seats taking turns in order (2 for
   * `1 e4 e5`); 1 when the game itself decides who moves next.
   */
  readonly perTurn: number;
  /**
   * The seat that made each move, in order; empty when the game itself
   * decides who moves next, so the record names no mover.
   */
  readonly movers: readonly FrameMover[];
  /**
   * The word before each move when the game's notation is a bare number
   * (`col`); `''` when the notation reads on its own.
   */
  readonly movePrefix?: string | undefined;
  readonly displayedPly: number;
  /** A refused review, in words; `''` for none. */
  readonly error: string;
  readonly history: boolean;
};
