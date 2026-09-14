/**
 * WAAPI / FLIP-style piece motion runner. Interruptible: a new plan cancels
 * prior animations and retargets from the current computed transform.
 */

import type { PieceMotion } from '@pkgs/chess-board-core/animation/position-diff';
import type { Timers } from '@pkgs/clock/types';

export type AnimationRunner = {
  readonly play: (motions: readonly PieceMotion[], durationMs: number) => void;
  readonly cancel: () => void;
};

export type AnimationTarget = {
  readonly element: Element;
  readonly fromTransform: string;
  readonly toTransform: string;
};

/**
 * Play transform animations on elements. Uses Element.animate when available;
 * otherwise snaps via timers.
 */
export function createAnimationRunner(args: {
  readonly timers: Timers;
  readonly reducedMotion: () => boolean;
  readonly resolveTarget: (motion: PieceMotion) => AnimationTarget | null;
}): AnimationRunner {
  const pending: Animation[] = [];
  let timeoutHandle: unknown;

  const cancel = (): void => {
    for (const a of pending) a.cancel();
    pending.length = 0;
    if (timeoutHandle !== undefined) {
      args.timers.clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
  };

  return {
    cancel,
    play(motions, durationMs) {
      cancel();
      if (args.reducedMotion() || durationMs <= 0 || motions.length === 0) {
        return;
      }
      for (const motion of motions) {
        if (motion.kind === 'disappear' || motion.kind === 'appear') continue;
        const target = args.resolveTarget(motion);
        if (target === null) continue;
        if (typeof target.element.animate !== 'function') continue;
        const anim = target.element.animate(
          [
            { transform: target.fromTransform },
            { transform: target.toTransform },
          ],
          {
            duration: durationMs,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'forwards',
          }
        );
        pending.push(anim);
      }
      timeoutHandle = args.timers.setTimeout(() => {
        cancel();
      }, durationMs + 16);
    },
  };
}
