import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from '@solidjs/web';
import type { FrameReviewHandlers } from './game-frame-moves-view';
import type { FrameConfirmOperation } from './game-frame-shell';
import type {
  FrameConnection,
  FrameNext,
  FramePeople,
  FramePhase,
  FramePlay,
  FrameRecord,
  FrameResult,
  FrameSetup,
  FrameStatus,
  FrameTable,
} from './game-frame-view-types';
import type { GameSessionPlace } from './game-session-places';

/** What the room says about the game; `PlayFriendScreenView` adds the place and the confirmation. */
export type GameFrameScreenData = FrameReviewHandlers & {
  readonly title: JSX.Element;
  /** How the game is won, in one sentence; absent before there is a game. */
  readonly goal?: string | undefined;
  /** Set when the person may not watch this space's games. */
  readonly denial?: DenialView | undefined;
  /** The game's stage: nobody navigates it. */
  readonly phase: FramePhase;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide: GameSide | null;
  readonly watchers: number;
  readonly connection: FrameConnection;
  /** A refused choice, in words; `''` for none. */
  readonly error: string;
  /** The game's own engine stopped; the saved score is kept. */
  readonly stopped: boolean;
  /** Starts a stopped game again from its saved score. */
  readonly onReopen?: (() => void) | undefined;
  /** `null` with no game. */
  readonly status: FrameStatus | null;
  /** May create a game (before there is one). */
  readonly canCreate: boolean;
  /**
   * Who the stored game is with. Each screen template is fixed to one
   * mode; the template does not switch on this.
   */
  readonly mode: 'vs-human' | 'vs-bot';
  readonly sides: readonly GameSide[];
  /** While the game is set up. */
  readonly setup: FrameSetup | null;
  /** The seats around the board once the game is played. */
  readonly table: FrameTable;
  readonly play: FramePlay;
  /** Once the game is over. */
  readonly result: FrameResult | null;
  readonly next: FrameNext;
  readonly record: FrameRecord | null;
  /** The game's own board and its controls; the only part the game draws. */
  readonly board?: JSX.Element;
  /** The game's own private setup board, while the viewer arranges theirs. */
  readonly setupBoard?: JSX.Element;
  /** Public render state on the board stage, for automated observers. */
  readonly boardState?: Readonly<Record<string, string>> | undefined;
  /** The game's square fit (`GameFrame.boardFit`); absent for width alone. */
  readonly boardFit?: 'square' | undefined;
  /** Where the board sits on one column (`GameFrame.boardAlign`); absent: centred. */
  readonly boardAlign?: 'start' | undefined;
  /**
   * The board is its own workspace (`GameFrame.boardWorkspace`): the
   * fixed view holds its box like any board's but never narrows it.
   */
  readonly boardWorkspace?: boolean | undefined;
  readonly menuMatchCommands?: boolean | undefined;
  readonly people?: FramePeople | undefined;
  /** Every choice about the game, as the room accepts it. */
  readonly onChoose: (input: GameSessionInput) => Promise<void>;
  readonly onReady: () => Promise<void>;
  readonly onRandomSetup: () => Promise<void>;
  /** Leave the game session for the space. */
  readonly onBack: () => void;
};

export type GameSessionScreenViewProps = GameFrameScreenData & {
  /**
   * The small screen shown, one of those the game's phase allows
   * (`GAME_SESSION_PLACES`). The container reconciles it with the phase;
   * a place the data cannot show falls back to the phase's home.
   */
  readonly place: GameSessionPlace;
  /** Show another of the phase's places. */
  readonly onOpen: (place: GameSessionPlace) => void;
  /** One step back, towards the phase's home. */
  readonly onClose: () => void;
};

/** What every place is given: the frame's data, and asking for its one confirmation. */
export type FramePlaceProps = GameSessionScreenViewProps & {
  /** Ask to resign or cancel: confirmed over whichever place is shown. */
  readonly onConfirm: (operation: FrameConfirmOperation) => void;
};
