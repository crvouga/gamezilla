/**
 * Reactive board model: binds the framework-free {@link ChessGame} and
 * {@link BoardInteraction} stores to Solid signals, keeps the local rules
 * instance in sync with the parent-owned `fen` / `fenSyncKey`, sequences move
 * SFX, and derives stable piece rows + the capture ghost for the pieces layer.
 */

import { chessGameRules } from '@pkgs/chess-board-core-shared-ts/board-rules';
import type { CaptureGhost } from '@pkgs/chess-board-core-shared-ts/capture-ghost';
import { captureGhostForTransition } from '@pkgs/chess-board-core-shared-ts/capture-ghost';
import type {
  ChessGame,
  ChessGameSnapshot,
} from '@pkgs/chess-board-core-shared-ts/game';
import { indexFromSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import type { BoardInteractionSnapshot } from '@pkgs/chess-board-core-shared-ts/interaction';
import { BoardInteraction } from '@pkgs/chess-board-core-shared-ts/interaction';
import type {
  ChessMoveSoundPlayer,
  PostMoveAudio,
} from '@pkgs/chess-board-core-shared-ts/move-sound';
import { createMoveSoundScheduler } from '@pkgs/chess-board-core-shared-ts/move-sound';
import { pieceCode } from '@pkgs/chess-board-core-shared-ts/piece-code';
import type { ChessPieceRow } from '@pkgs/chess-board-core-shared-ts/piece-rows';
import { createPieceRowsTracker } from '@pkgs/chess-board-core-shared-ts/piece-rows';
import type {
  BoardOrientation,
  Move,
  PieceColor,
  Position,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';

export type ChessBoardModelArgs = {
  readonly game: ChessGame;
  readonly fen: Accessor<string | undefined>;
  readonly fenSyncKey: Accessor<number | undefined>;
  readonly interactive: Accessor<boolean>;
  readonly soundEnabled: Accessor<boolean>;
  readonly orientation: Accessor<BoardOrientation>;
  /** Pieces slide (motion policy); the capture ghost only covers a slide. */
  readonly animated: Accessor<boolean>;
  /** Slide duration; capture SFX and the ghost follow it. */
  readonly moveDurationMs: Accessor<number>;
  readonly onMove: (move: Move) => void;
  /** A gesture tried an illegal move (after the illegal sound). */
  readonly onIllegal: () => void;
  readonly sounds: ChessMoveSoundPlayer & { readonly cancel: () => void };
  readonly timers: Timers;
  readonly premoves: Accessor<boolean>;
  readonly autoPromoteQueen: Accessor<boolean>;
  /** Seated color for premove ownership (from board orientation). */
  readonly playerColor: Accessor<PieceColor | null>;
};

export type ChessBoardModel = {
  readonly game: Accessor<ChessGameSnapshot>;
  readonly interaction: Accessor<BoardInteractionSnapshot>;
  readonly actions: BoardInteraction;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly captureGhost: Accessor<CaptureGhost | null>;
  readonly captureTargets: Accessor<readonly Square[]>;
};

function createExternalFenSync(
  args: ChessBoardModelArgs,
  interaction: BoardInteraction,
  playMove: (move: Move, post: PostMoveAudio) => void,
  cancelSound: () => void
): void {
  let prevFenProp: string | undefined;
  let prevKey: number | undefined;
  let seen = false;
  createEffect(
    () => [args.fen(), args.fenSyncKey()] as const,
    ([fen, key]) => {
      if (fen === undefined || fen.length === 0) return;
      if (seen && fen === prevFenProp && key === prevKey) return;
      const localFen = args.game.getSnapshot().fen;
      seen = true;
      prevFenProp = fen;
      prevKey = key;
      if (localFen === fen) return;
      const result = args.game.applyExternalFen(fen);
      if (result === null) return;
      cancelSound();
      interaction.clear({ retainPremmove: result.moved !== null });
      // A canonical successor may include confirmation and the opponent reply
      // in one parent update. Replacements and rejected optimistic moves
      // have no legal inferred move, so they stay silent and unhighlighted.
      if (result.moved !== null) {
        playMove(result.moved, result);
        interaction.flushPremmove();
        return;
      }
      interaction.clear();
      args.game.clearLastMove();
    }
  );
}

type CaptureOwner = { square: Square; code: string };
function captureOwner(
  position: Position,
  move: Move | null
): CaptureOwner | undefined {
  if (move === null) return undefined;
  const piece = position[indexFromSquare(move.to)];
  if (piece === undefined || piece === null) return undefined;
  return { square: move.to, code: pieceCode(piece.color, piece.type) ?? '' };
}
function ownerRemains(owner: CaptureOwner | undefined, position: Position) {
  if (owner === undefined) return false;
  const piece = position[indexFromSquare(owner.square)];
  return (
    piece !== undefined &&
    piece !== null &&
    pieceCode(piece.color, piece.type) === owner.code
  );
}
function createCaptureGhost(
  args: ChessBoardModelArgs,
  game: Accessor<ChessGameSnapshot>
): Accessor<CaptureGhost | null> {
  const [ghost, setGhost] = createSignal<CaptureGhost | null>(null);
  let prev: Position | null = null;
  let orientation: BoardOrientation | undefined;
  let animated: boolean | undefined;
  let handle: unknown;
  let owner: CaptureOwner | undefined;
  const clear = (): void => {
    if (handle !== undefined) args.timers.clearTimeout(handle);
    handle = undefined;
  };
  onCleanup(clear);
  // The ghost shown now, tracked beside the signal: a transition decides
  // from what it last set, before that write is readable.
  let shown: CaptureGhost | null = null;
  const show = (next: CaptureGhost | null): void => {
    shown = next;
    setGhost(next);
  };
  createEffect(
    () =>
      ({
        snapshot: game(),
        slides: args.animated(),
        facing: args.orientation(),
        durationMs: args.moveDurationMs(),
      }) as const,
    ({ snapshot, slides, facing, durationMs }) => {
      const { position, lastMove } = snapshot;
      if (position === prev && slides === animated && facing === orientation)
        return;
      const next = captureGhostForTransition({
        prev,
        position,
        lastMove,
        animations:
          slides && (orientation === undefined || facing === orientation),
      });
      const retained =
        next === null &&
        shown !== null &&
        slides &&
        facing === orientation &&
        lastMove !== null &&
        ownerRemains(owner, position);
      prev = position;
      animated = slides;
      orientation = facing;
      if (retained) return;
      clear();
      show(next);
      owner = undefined;
      if (next === null) return;
      owner = captureOwner(position, lastMove);
      handle = args.timers.setTimeout(() => {
        handle = undefined;
        show(null);
      }, durationMs);
    }
  );
  return ghost;
}

export function createChessBoardModel(
  args: ChessBoardModelArgs
): ChessBoardModel {
  const scheduler = createMoveSoundScheduler(args.sounds, args.timers);
  const cancelSound = (): void => {
    scheduler.dispose();
    args.sounds.cancel();
  };
  onCleanup(cancelSound);
  createEffect(
    () => args.soundEnabled(),
    (enabled) => {
      if (!enabled) cancelSound();
    }
  );
  // A move is played by a gesture, by a parent's position or by a queued
  // premove: each reads the sound and motion settings as they are then.
  const soundOn = (): boolean => untrack(args.soundEnabled);
  const playMove = (move: Move, post: PostMoveAudio): void => {
    args.sounds.cancel();
    if (!soundOn()) return;
    scheduler.apply(move, post, {
      captureDelayMs:
        untrack(args.animated) && move.captured !== undefined
          ? untrack(args.moveDurationMs)
          : 0,
    });
  };

  const actions = new BoardInteraction(
    chessGameRules(args.game),
    {
      onApplied: (result) => {
        playMove(result.move, result);
        args.onMove(result.move);
      },
      onIllegal: () => {
        if (soundOn()) args.sounds.playIllegal();
        args.onIllegal();
      },
    },
    // The first value only: the effect below keeps the store in step.
    untrack(args.interactive)
  );
  createEffect(args.interactive, (value) => {
    actions.setInteractive(value);
  });
  createEffect(args.premoves, (value) => {
    actions.setPremovesEnabled(value);
  });
  createEffect(args.autoPromoteQueen, (value) => {
    actions.setAutoPromoteQueen(value);
  });
  createEffect(args.playerColor, (value) => {
    actions.setPlayerColor(value);
  });

  const game = createSubscriptionSignal(args.game);
  const interaction = createSubscriptionSignal(actions);

  createExternalFenSync(args, actions, playMove, cancelSound);

  // Local apply flips the turn — flush if a premove was queued somehow.
  createEffect(
    () => game().turn,
    () => {
      actions.flushPremmove();
    },
    { defer: true }
  );

  const tracker = createPieceRowsTracker();
  const rows = createMemo(() => {
    const snapshot = game();
    return tracker.next(snapshot.position, snapshot.lastMove);
  });

  const captureTargets = createMemo(() => {
    const current = game();
    const ix = interaction();
    const from = ix.selected ?? ix.dragFrom;
    return from === null || current.isGameOver
      ? []
      : args.game.legalCapturesFrom(from);
  });
  return {
    game,
    interaction,
    actions,
    rows,
    captureGhost: createCaptureGhost(args, game),
    captureTargets,
  };
}
