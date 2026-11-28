/**
 * A Game Session as a person's screen shows it — the reads a game's own
 * harness may use (`gameApi`). Each is a projection the framework
 * promises, never the room's stored game-session state: a game reads who
 * sits where, whose turn it is, how the game ended and what the person was
 * told, and the framework stays free to change how it keeps them.
 */
import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
import {
  gameSessionActiveParticipant,
  gameSessionTimeLeft,
} from '@libs/game-session-shared-ts/game-session-state';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { readGameSessionBoundary } from './game-session-boundary';
import type { GameSessionProbe } from './game-session-probe';
import { readGameSessionProbe } from './game-session-probe';

/** A choice a person makes in a Game Session: create, open a side, invite, move, … */
export type GameSessionAction = GameSessionInput;

/** One side of a Game Session: who sits there (a member identity), if anyone. */
export type GameSessionSeatShown = {
  readonly kind: 'person' | 'bot' | 'local' | 'invitation' | 'open' | 'closed';
  /** The member identity of the person seated or invited; '' otherwise. */
  readonly person: string;
};

/** The Game Session on a person's screen. */
export type GameSessionShown = {
  readonly id: string;
  readonly revision: number;
  readonly status: 'configuring' | 'active' | 'completed' | 'cancelled';
  readonly white: GameSessionSeatShown;
  readonly black: GameSessionSeatShown;
  readonly red: GameSessionSeatShown;
  readonly blue: GameSessionSeatShown;
  readonly sides: readonly GameSide[];
  readonly outcomeReason: string;
  readonly drawAcceptedBy: readonly string[];
  /** The sides whose people said they are ready. */
  readonly ready: readonly GameSide[];
  /** The side to move. */
  readonly turn: GameSide;
  /** How the game ended (`white wins by resignation`), '' while it is not over. */
  readonly outcome: string;
  /**
   * The accepted actions in order, each as the game labels it (the durable
   * record names: `uci` the action, `san` its label).
   */
  readonly moves: readonly { readonly uci: string; readonly san: string }[];
};

/** What a person's Game Session screen shows. */
export type GameSessionScreen = {
  /** The person's own member identity in the space. */
  readonly me: string;
  /** The side the person plays, if any. */
  readonly mySide: GameSide | null;
  /** The Game Session shown, or `null` before one is created. */
  readonly current: GameSessionShown | null;
  /** The position the board shows: an earlier one while reviewing. */
  readonly position: string;
  /** What the screen last refused, '' when nothing. */
  readonly error: string;
  /** Whether the screen is connected to the live game. */
  readonly connected: boolean;
};

function shown(probe: GameSessionProbe): GameSessionScreen {
  const game = probe.current;
  return {
    me: probe.myId,
    mySide: probe.mySide,
    current:
      game === null
        ? null
        : {
            id: game.id,
            revision: game.revision,
            status: game.status,
            white: { kind: game.white.kind, person: game.white.person },
            black: { kind: game.black.kind, person: game.black.person },
            red: { kind: game.red.kind, person: game.red.person },
            blue: { kind: game.blue.kind, person: game.blue.person },
            sides: [...game.sides],
            outcomeReason: game.outcomeReason,
            drawAcceptedBy: [...game.drawAcceptedBy],
            ready: [...game.ready],
            turn: game.turn,
            outcome: game.outcome,
            moves: game.moves.map(({ uci, san }) => ({ uci, san })),
          },
    position: probe.displayFen,
    error: probe.error,
    connected: probe.connected,
  };
}

/** `actor`'s Game Session screen, or `null` when none is on screen. */
export async function readGameSessionScreen(
  s: ProductHarness,
  actor: string
): Promise<GameSessionScreen | null> {
  const probe = await readGameSessionProbe(s, actor);
  return probe === null ? null : shown(probe);
}

/**
 * What `actor` was last told was refused: by their Game Session screen, or,
 * for a device the screen never reached, by the space's own boundary.
 */
export async function readGameSessionRefusal(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (
    (await readGameSessionProbe(s, actor))?.error ??
    readGameSessionBoundary(s, actor)?.reason ??
    null
  );
}

/** Whether `actor` plays in the active Game Session of the space they see. */
export async function inActiveGameSession(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const probe = await readGameSessionProbe(s, actor);
  return probe !== null && gameSessionActiveParticipant(probe, probe.myId);
}

/** The time the side to move has left now, in the Game Session `actor` sees. */
export async function gameSessionTimeLeftMs(
  s: ProductHarness,
  actor: string
): Promise<number> {
  const game = (await readGameSessionProbe(s, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no Game Session`);
  return gameSessionTimeLeft(game, game.turn, s.harness.clock.now());
}
