/**
 * Where the board reads its {@link BoardMotionEnvironment}: a
 * {@link BoardMotionProvider} (tests record slides through one), else the
 * browser's own ({@link createWallMotionEnvironment}).
 */

import type {
  AnimateTransform,
  BoardMotionEnvironment,
} from '@pkgs/chess-board-shared/board-motion';
import { isLowEndDevice } from '@pkgs/chess-board-shared/board-motion';
import { createContext, createSignal, onCleanup, useContext } from 'solid-js';

const BoardMotionContext = createContext<BoardMotionEnvironment | undefined>(
  undefined
);

export const BoardMotionProvider = BoardMotionContext.Provider;

/** Slide easing: fast start, gentle landing (reads as responsive). */
const SLIDE_EASING = 'cubic-bezier(0.25, 0.8, 0.25, 1)';

function webAnimate(): AnimateTransform | null {
  if (typeof Element === 'undefined') return null;
  if (typeof Element.prototype.animate !== 'function') return null;
  return (element, from, to, durationMs) => {
    const animation = element.animate(
      [{ transform: from }, { transform: to }],
      { duration: durationMs, easing: SLIDE_EASING }
    );
    // `cancel()` rejects `finished` with an AbortError. Browsers mark that
    // rejection handled; happy-dom does not, so a cancelled slide would
    // surface as an unhandled rejection. Cancelling is expected here.
    animation.finished.catch(() => undefined);
    return {
      cancel: () => animation.cancel(),
      onFinish: (callback) => {
        animation.onfinish = callback;
      },
    };
  };
}

function reducedMotionSignal(): () => boolean {
  const mq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const [reduced, setReduced] = createSignal(mq?.matches === true);
  if (mq !== null) {
    const onChange = (): void => {
      setReduced(mq.matches);
    };
    mq.addEventListener('change', onChange);
    onCleanup(() => mq.removeEventListener('change', onChange));
  }
  return reduced;
}

function hiddenSignal(): () => boolean {
  const [hidden, setHidden] = createSignal(
    document.visibilityState === 'hidden'
  );
  const onChange = (): void => {
    setHidden(document.visibilityState === 'hidden');
  };
  document.addEventListener('visibilitychange', onChange);
  onCleanup(() => document.removeEventListener('visibilitychange', onChange));
  return hidden;
}

/** The running browser's motion capabilities. Call inside a Solid owner. */
export function createWallMotionEnvironment(): BoardMotionEnvironment {
  return {
    animate: webAnimate(),
    prefersReducedMotion: reducedMotionSignal(),
    lowEnd: isLowEndDevice(globalThis.navigator),
    hidden: hiddenSignal(),
    paintedTransform: (element) =>
      element.ownerDocument.defaultView?.getComputedStyle(element).transform ??
      '',
  };
}

/** Provided environment, else the browser's. Call inside a Solid owner. */
export function useBoardMotionEnvironment(): BoardMotionEnvironment {
  return useContext(BoardMotionContext) ?? createWallMotionEnvironment();
}
