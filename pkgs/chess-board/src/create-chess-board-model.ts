/**
 * Reactive board model: binds the framework-free {@link ChessGame} and
 * {@link BoardInteraction} stores to Solid signals, keeps the local rules
 * instance in sync with the parent-owned `fen` / `fenSyncKey`, sequences move
 * SFX, and derives stable piece rows + the capture ghost for the pieces layer.
 */

import { chessGameRules } from '@pkgs/chess-board-core/board-rules';
import {
  type CaptureGhost,
  captureGhostForTransition,
} from '@pkgs/chess-board-core/capture-ghost';
import type { ChessGame, ChessGameSnapshot } from '@pkgs/chess-board-core/game';
import {
  BoardInteraction,
  type BoardInteractionSnapshot,
} from '@pkgs/chess-board-core/interaction';
import {
  type ChessMoveSoundPlayer,
  createMoveSoundScheduler,
  type PostMoveAudio,
} from '@pkgs/chess-board-core/move-sound';
import {
  type ChessPieceRow,
  createPieceRowsTracker,
} from '@pkgs/chess-board-core/piece-rows';
import type { Move, PieceColor, Position } from '@pkgs/chess-board-core/types';
import type { Timers } from '@pkgs/clock/types';
import { createSubscriptionSignal } from '@pkgs/solid-context/subscription-signal';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';

export type ChessBoardModelArgs = {
  readonly game: ChessGame;
  readonly fen: Accessor<string | undefined>;
  readonly fenSyncKey: Accessor<number | undefined>;
  readonly interactive: Accessor<boolean>;
  /** Pieces slide (motion policy); the capture ghost only covers a slide. */
  readonly animated: Accessor<boolean>;
  /** Slide duration; capture SFX and the ghost follow it. */
  readonly moveDurationMs: Accessor<number>;
  readonly onMove: (move: Move) => void;
  /** A gesture tried an illegal move (after the illegal sound). */
  readonly onIllegal: () => void;
  readonly sounds: ChessMoveSoundPlayer;
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
};

function createExternalFenSync(
  args: ChessBoardModelArgs,
  interaction: BoardInteraction,
  playMove: (move: Move, post: PostMoveAudio) => void
): void {
  let prevFenProp: string | undefined;
  createEffect(
    on([args.fen, args.fenSyncKey], ([fen]) => {
      if (fen === undefined || fen.length === 0) return;
      const localFen = args.game.getSnapshot().fen;
      const wasInSync = prevFenProp === undefined || localFen === prevFenProp;
      const result = args.game.applyExternalFen(fen);
      prevFenProp = fen;
      // Keep a queued premove across opponent plies so flushPremmove can run.
      interaction.clear({ retainPremmove: true });
      if (result === null) return;
      // A single-ply external change while in sync is an opponent / canned
      // reply: keep its last-move highlight and play SFX. Optimistic desync
      // repairs (wrong-move revert) stay silent and unhighlighted.
      if (result.moved !== null && wasInSync) {
        playMove(result.moved, result);
        interaction.flushPremmove();
        return;
      }
      interaction.clear();
      args.game.clearLastMove();
    })
  );
}

function createCaptureGhost(
  args: ChessBoardModelArgs,
  game: Accessor<ChessGameSnapshot>
): Accessor<CaptureGhost | null> {
  const [ghost, setGhost] = createSignal<CaptureGhost | null>(null);
  let prev: Position | null = null;
  let handle: unknown;
  const clear = (): void => {
    if (handle !== undefined) args.timers.clearTimeout(handle);
    handle = undefined;
  };
  onCleanup(clear);
  createEffect(
    on(
      () => game().position,
      (position) => {
        const next = captureGhostForTransition({
          prev,
          position,
          lastMove: game().lastMove,
          animations: args.animated(),
        });
        prev = position;
        if (next === null) return;
        clear();
        setGhost(next);
        handle = args.timers.setTimeout(() => {
          setGhost(null);
        }, args.moveDurationMs());
      }
    )
  );
  return ghost;
}

export function createChessBoardModel(
  args: ChessBoardModelArgs
): ChessBoardModel {
  const scheduler = createMoveSoundScheduler(args.sounds, args.timers);
  onCleanup(scheduler.dispose);
  const playMove = (move: Move, post: PostMoveAudio): void => {
    scheduler.apply(move, post, {
      captureDelayMs:
        args.animated() && move.captured !== undefined
          ? args.moveDurationMs()
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
        args.sounds.playIllegal();
        args.onIllegal();
      },
    },
    args.interactive()
  );
  createEffect(() => actions.setInteractive(args.interactive()));
  createEffect(() => actions.setPremovesEnabled(args.premoves()));
  createEffect(() => actions.setAutoPromoteQueen(args.autoPromoteQueen()));
  createEffect(() => actions.setPlayerColor(args.playerColor()));

  const game = createSubscriptionSignal(args.game);
  const interaction = createSubscriptionSignal(actions);

  createExternalFenSync(args, actions, playMove);

  // Local apply flips the turn — flush if a premove was queued somehow.
  createEffect(
    on(
      () => game().turn,
      () => {
        actions.flushPremmove();
      },
      { defer: true }
    )
  );

  const tracker = createPieceRowsTracker();
  const rows = createMemo(() => {
    const snapshot = game();
    return tracker.next(snapshot.position, snapshot.lastMove);
  });

  return {
    game,
    interaction,
    actions,
    rows,
    captureGhost: createCaptureGhost(args, game),
  };
}
