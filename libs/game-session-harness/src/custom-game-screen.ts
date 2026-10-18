/**
 * A Custom Game as a person's screen shows it — the reads a game's own
 * harness may use (`gameApi`). Each is a projection the framework
 * promises, never the room's stored custom-game state: a game reads who
 * sits where, whose turn it is, how the game ended and what the person was
 * told, and the framework stays free to change how it keeps them.
 */
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import {
  customGameActiveParticipant,
  customGameTimeLeft,
} from '@libs/game-session-shared/custom-game-state';
import type { ProductHarness } from '@libs/harness/harness';
import type { GameSide } from '@pkgs/turn-game-shared/game-rules';
import { readCustomGameBoundary } from './custom-game-boundary';
import type { CustomGameProbe } from './custom-game-probe';
import { readCustomGameProbe } from './custom-game-probe';

/** A choice a person makes in a Custom Game: create, open a side, invite, move, … */
export type CustomGameAction = CustomGameInput;

/** One side of a Custom Game: who sits there (a member identity), if anyone. */
export type CustomGameSeatShown = {
  readonly kind: 'person' | 'bot' | 'invitation' | 'open' | 'closed';
  /** The member identity of the person seated or invited; '' otherwise. */
  readonly person: string;
};

/** The Custom Game on a person's screen. */
export type CustomGameShown = {
  readonly id: string;
  readonly revision: number;
  readonly status: 'configuring' | 'active' | 'completed' | 'cancelled';
  readonly white: CustomGameSeatShown;
  readonly black: CustomGameSeatShown;
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

/** What a person's Custom Game screen shows. */
export type CustomGameScreen = {
  /** The person's own member identity in the space. */
  readonly me: string;
  /** The side the person plays, if any. */
  readonly mySide: GameSide | null;
  /** The Custom Game shown, or `null` before one is created. */
  readonly current: CustomGameShown | null;
  /** The position the board shows: an earlier one while reviewing. */
  readonly position: string;
  /** What the screen last refused, '' when nothing. */
  readonly error: string;
  /** Whether the screen is connected to the live game. */
  readonly connected: boolean;
};

function shown(probe: CustomGameProbe): CustomGameScreen {
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

/** `actor`'s Custom Game screen, or `null` when none is on screen. */
export async function readCustomGameScreen(
  s: ProductHarness,
  actor: string
): Promise<CustomGameScreen | null> {
  const probe = await readCustomGameProbe(s, actor);
  return probe === null ? null : shown(probe);
}

/**
 * What `actor` was last told was refused: by their Custom Game screen, or,
 * for a device the screen never reached, by the space's own boundary.
 */
export async function readCustomGameRefusal(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (
    (await readCustomGameProbe(s, actor))?.error ??
    readCustomGameBoundary(s, actor)?.reason ??
    null
  );
}

/** Whether `actor` plays in the active Custom Game of the space they see. */
export async function inActiveCustomGame(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const probe = await readCustomGameProbe(s, actor);
  return probe !== null && customGameActiveParticipant(probe, probe.myId);
}

/** The time the side to move has left now, in the Custom Game `actor` sees. */
export async function customGameTimeLeftMs(
  s: ProductHarness,
  actor: string
): Promise<number> {
  const game = (await readCustomGameProbe(s, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no Custom Game`);
  return customGameTimeLeft(game, game.turn, s.harness.clock.now());
}
