/**
 * `TypingDots` -- classic chat "..." typing indicator.
 *
 * Three dots fade between {@link DOT_BASE_OPACITY} and
 * {@link DOT_PEAK_OPACITY} in a staggered loop driven off a single shared
 * `Animated.Value`, so the JS thread is idle while loading. Uses
 * `useNativeDriver: true` -- the only thing that animates is `opacity`,
 * which the browser/native composite without layout/paint.
 *
 * The container collapses to a single text-line band by default (matches
 * the {@link SpeechBubble} body's first line) so a caller can swap it in
 * for a `<Text>` without changing the surrounding height.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';

/** Total length of one loop cycle. ~1200ms feels close to iMessage. */
const DOTS_CYCLE_MS = 1200;
const DOT_SIZE = 6;
const DOT_GAP = 4;
const DOT_BASE_OPACITY = 0.3;
const DOT_PEAK_OPACITY = 1.0;
/** Default container height -- matches `bodyBold`'s `lineHeight` in `text.tsx`. */
const DEFAULT_HEIGHT = 26;
/**
 * Normalised cycle position (0..1) where each dot reaches peak opacity.
 * Spacing them by 0.2 produces a staggered wave; the trailing ~0.4 of
 * the cycle is "silence" so the rhythm reads as typing, not strobing.
 */
const DOT_PEAKS = [0.1, 0.3, 0.5] as const;
/** Half-width of each dot's bright window. Smaller = punchier flash. */
const DOT_HALF_WIDTH = 0.08;

export type TypingDotsProps = {
  /** Dot fill color. */
  readonly color: string;
  /** Container height in px. Defaults to a single body-text line (26). */
  readonly height?: number;
};

export function TypingDots({
  color,
  height = DEFAULT_HEIGHT,
}: TypingDotsProps): ReactNode {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: DOTS_CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [progress]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: DOT_GAP,
        height,
      }}
    >
      {DOT_PEAKS.map((peak, i) => {
        const opacity = progress.interpolate({
          inputRange: [
            0,
            peak - DOT_HALF_WIDTH,
            peak,
            peak + DOT_HALF_WIDTH,
            1,
          ],
          outputRange: [
            DOT_BASE_OPACITY,
            DOT_BASE_OPACITY,
            DOT_PEAK_OPACITY,
            DOT_BASE_OPACITY,
            DOT_BASE_OPACITY,
          ],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
