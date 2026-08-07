/**
 * Shared reveal progress (0..1) for Control Center-style status overlay.
 * Strip pan opens; grabber pan + close button dismiss.
 */

import { useCallback, useMemo, useState } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  type SharedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { createStatusBarHandlePan } from './status-bar-dismiss-gesture';
import {
  clamp01,
  progressVelocityFromPixels,
  STATUS_BAR_COMMIT_PROGRESS,
  STATUS_BAR_COMMIT_VELOCITY,
  STATUS_BAR_REVEAL_SPRING,
  springProgressTo,
} from './status-bar-reveal-shared';

/** Fraction of window height used as full reveal travel. */
const REVEAL_HEIGHT_RATIO = 0.4;

export type StatusBarReveal = {
  progress: SharedValue<number>;
  /** Overlay should mount (may be non-interactive while opening). */
  active: boolean;
  /** Overlay receives touches (fully open / dismissing). */
  interactive: boolean;
  /** True while a strip/grabber pan is actively held (web `grabbing` cursor). */
  isGrabbing: boolean;
  revealDistance: number;
  openAnimated: () => void;
  closeAnimated: () => void;
  openPan: ReturnType<typeof Gesture.Pan>;
  /** Always-on upward pan for the grabber handle. */
  handlePan: ReturnType<typeof Gesture.Pan>;
};

export type UseStatusBarRevealArgs = {
  onOpened: () => void;
  onClosed: () => void;
};

function useRevealLifecycle(onOpened: () => void, onClosed: () => void) {
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [isGrabbing, setGrabbing] = useState(false);

  const markActive = useCallback(() => {
    setInteractive(false);
    setActive(true);
  }, []);

  const handleOpened = useCallback(() => {
    setActive(true);
    setInteractive(true);
    onOpened();
  }, [onOpened]);

  const handleClosed = useCallback(() => {
    setInteractive(false);
    setActive(false);
    onClosed();
  }, [onClosed]);

  const openAnimated = useCallback(() => {
    setGrabbing(false);
    setInteractive(false);
    setActive(true);
    progress.value = withSpring(1, STATUS_BAR_REVEAL_SPRING, (finished) => {
      if (finished) {
        runOnJS(handleOpened)();
      }
    });
  }, [handleOpened, progress]);

  const closeAnimated = useCallback(() => {
    setGrabbing(false);
    setInteractive(false);
    progress.value = withSpring(0, STATUS_BAR_REVEAL_SPRING, (finished) => {
      if (finished) {
        runOnJS(handleClosed)();
      }
    });
  }, [handleClosed, progress]);

  return {
    progress,
    active,
    interactive,
    isGrabbing,
    setGrabbing,
    markActive,
    handleOpened,
    handleClosed,
    openAnimated,
    closeAnimated,
  };
}

export function useStatusBarReveal({
  onOpened,
  onClosed,
}: UseStatusBarRevealArgs): StatusBarReveal {
  const revealDistance = Dimensions.get('window').height * REVEAL_HEIGHT_RATIO;
  const life = useRevealLifecycle(onOpened, onClosed);
  const {
    progress,
    markActive,
    handleOpened,
    handleClosed,
    openAnimated,
    closeAnimated,
    active,
    interactive,
    isGrabbing,
    setGrabbing,
  } = life;

  const openPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-20, 20])
        .onTouchesDown(() => {
          runOnJS(setGrabbing)(true);
          runOnJS(markActive)();
        })
        .onUpdate((e) => {
          progress.value = clamp01(e.translationY / revealDistance);
        })
        .onEnd((e) => {
          const velocity = progressVelocityFromPixels(
            e.velocityY,
            revealDistance
          );
          const shouldOpen =
            progress.value >= STATUS_BAR_COMMIT_PROGRESS ||
            e.velocityY >= STATUS_BAR_COMMIT_VELOCITY;
          if (shouldOpen) {
            springProgressTo(progress, 1, handleOpened, velocity);
          } else {
            springProgressTo(progress, 0, handleClosed, velocity);
          }
        })
        .onFinalize((_e, success) => {
          runOnJS(setGrabbing)(false);
          if (!success && progress.value <= 0.02) {
            runOnJS(handleClosed)();
          }
        }),
    [
      handleClosed,
      handleOpened,
      markActive,
      progress,
      revealDistance,
      setGrabbing,
    ]
  );

  const handlePan = useMemo(
    () =>
      createStatusBarHandlePan({
        progress,
        revealDistance,
        handleOpened,
        handleClosed,
        setGrabbing,
      }),
    [handleClosed, handleOpened, progress, revealDistance, setGrabbing]
  );

  return {
    progress,
    active,
    interactive,
    isGrabbing,
    revealDistance,
    openAnimated,
    closeAnimated,
    openPan,
    handlePan,
  };
}
