/**
 * Move audio sequencing without stacking: one primary sound per ply
 * (move / capture / castle / promote), then check and game-end after gaps.
 * The player port and timers are injected; nothing here touches the wall.
 */

import type { Timers } from '@pkgs/clock/types';

import type { Move } from './types';

export type ChessMoveSoundPlayer = {
  readonly playMove: () => void;
  readonly playCapture: () => void;
  readonly playCheck: () => void;
  readonly playCastle: () => void;
  readonly playPromote: () => void;
  readonly playIllegal: () => void;
  readonly playGameEnd: () => void;
};

export type PostMoveAudio = {
  readonly inCheck: boolean;
  readonly isGameOver: boolean;
};

/** Gap between capture and promote when both apply — never same tick. */
export const PROMOTE_AFTER_CAPTURE_MS = 120;
/** Delay before check/game-end so they never stack with the primary SFX. */
export const CHECK_AFTER_PRIMARY_MS = 160;
export const GAME_END_AFTER_CHECK_MS = 220;

export type MoveSoundStep = {
  readonly atMs: number;
  readonly sound: keyof ChessMoveSoundPlayer;
};

function primarySteps(move: Move, captureDelayMs: number): MoveSoundStep[] {
  if (move.promotion) {
    if (move.captured) {
      return [
        { atMs: captureDelayMs, sound: 'playCapture' },
        {
          atMs: captureDelayMs + PROMOTE_AFTER_CAPTURE_MS,
          sound: 'playPromote',
        },
      ];
    }
    return [{ atMs: 0, sound: 'playPromote' }];
  }
  if (move.castle) return [{ atMs: 0, sound: 'playCastle' }];
  if (move.captured) return [{ atMs: captureDelayMs, sound: 'playCapture' }];
  return [{ atMs: 0, sound: 'playMove' }];
}

/**
 * Pure timeline for one ply: primary sound(s) then follow-ups. Capture SFX
 * is deferred by `captureDelayMs` so it lands with the piece slide.
 */
export function planMoveSounds(args: {
  move: Move;
  post: PostMoveAudio;
  captureDelayMs: number;
}): readonly MoveSoundStep[] {
  const steps = primarySteps(args.move, args.captureDelayMs);
  const last = steps[steps.length - 1];
  const primaryOffsetMs = last === undefined ? 0 : last.atMs;
  const followUpBase = primaryOffsetMs + CHECK_AFTER_PRIMARY_MS;
  if (args.post.inCheck) steps.push({ atMs: followUpBase, sound: 'playCheck' });
  if (args.post.isGameOver) {
    const gameEndAt =
      followUpBase + (args.post.inCheck ? GAME_END_AFTER_CHECK_MS : 0);
    steps.push({ atMs: gameEndAt, sound: 'playGameEnd' });
  }
  return steps;
}

export type MoveSoundScheduler = {
  /** Cancels any pending follow-ups from the previous ply, then plays this one. */
  readonly apply: (
    move: Move,
    post: PostMoveAudio,
    options: { captureDelayMs: number }
  ) => void;
  /** Cancels everything still pending (unmount / board reset). */
  readonly dispose: () => void;
};

export function createMoveSoundScheduler(
  player: ChessMoveSoundPlayer,
  timers: Timers
): MoveSoundScheduler {
  let pending: unknown[] = [];
  const clearAll = () => {
    for (const handle of pending) timers.clearTimeout(handle);
    pending = [];
  };
  return {
    apply(move, post, options) {
      clearAll();
      for (const step of planMoveSounds({
        move,
        post,
        captureDelayMs: options.captureDelayMs,
      })) {
        if (step.atMs <= 0) {
          player[step.sound]();
          continue;
        }
        pending.push(
          timers.setTimeout(() => {
            player[step.sound]();
          }, step.atMs)
        );
      }
    },
    dispose: clearAll,
  };
}
