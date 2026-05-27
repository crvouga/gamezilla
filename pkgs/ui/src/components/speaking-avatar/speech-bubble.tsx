/**
 * Internal `SpeechBubble` -- rounded surface plate with a small
 * left-pointing tail. Used by {@link SpeakingAvatar}.
 *
 * The tail is a rotated `View` so we don't pull in an SVG dependency
 * just for a triangle.
 *
 * Two body states swap inside the same fixed-height surface, so neither
 * change reflows anything above or below:
 *
 *   - `loading=true` -> three-dot "typing" indicator (`./typing-dots.tsx`).
 *   - `loading=false` -> the full message rendered as plain `<Text>`.
 *
 * Entrance animation: instead of a per-glyph reveal, the whole bubble
 * (tail + surface together) slides in from the left and fades in
 * whenever `text` changes. Driven by a single `Animated.Value` with
 * `useNativeDriver: true`, so only `opacity` + `transform` are touched
 * per frame -- no layout/paint, no React state churn.
 *
 * Layout-shift lockdown: the bubble has a *fixed* `height` derived from
 * `numberOfLines * BUBBLE_LINE_HEIGHT + 2 * BUBBLE_PADDING_VERTICAL`. The
 * inner `<Text>` is also clipped to `numberOfLines` with
 * `ellipsizeMode="tail"` and pinned to the same explicit `lineHeight`.
 * The result: messages of any length, dots/text swaps, and font-metric
 * drift across web/iOS/Android cannot move anything that lives below the
 * bubble (e.g. the chess board on `chess-puzzle-play-screen`).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { useTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { borderRadius } from '../../theme/scale';
import { Text } from '../text';
import { TypingDots } from './typing-dots';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
/** Matches `text.tsx`'s `bodyBold` `lineHeight`. Pinned here so we can size the bubble deterministically. */
const BUBBLE_LINE_HEIGHT = 26;
/** Default lines reserved in the bubble; sized to cover typical coach copy without truncating. */
const DEFAULT_NUMBER_OF_LINES = 2;
/** Total length of the slide+fade entrance. Token-driven. */
const ENTER_DURATION_MS = duration.slow * 2;
/** How many px the bubble translates rightward over the entrance (starts left of resting). */
const ENTER_TRANSLATE_X = 24;

export const SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT = 28;

export type SpeechBubbleProps = {
  text: string;
  /** Optional strip rendered above the message body (e.g. puzzle status). */
  header?: ReactNode;
  /**
   * Number of lines reserved in the bubble. The bubble's height is
   * pinned to `numberOfLines * 26 + 24 px` (independent of `text`) so
   * messages of any length never shift anything below. Overflow is
   * clipped with `…`. Defaults to `2`.
   */
  numberOfLines?: number;
  /**
   * When `true`, hides `text` and renders the three-dot typing animation
   * instead. Use while TTS audio is still being synthesised / loaded.
   * Defaults to `false`.
   */
  loading?: boolean;
};

/**
 * Drives the slide-up + fade-in entrance. Re-runs whenever `text`
 * changes so each new message visually "pops" in. Deliberately *not*
 * keyed off `loading`: the dots-to-text swap inside the same bubble
 * shouldn't re-animate the whole surface.
 */
function useBubbleEnterAnim(text: string): {
  opacity: Animated.Value;
  translateX: Animated.AnimatedInterpolation<number>;
} {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [text, progress]);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-ENTER_TRANSLATE_X, 0],
  });
  return { opacity: progress, translateX };
}

export function SpeechBubble({
  text,
  header,
  numberOfLines = DEFAULT_NUMBER_OF_LINES,
  loading = false,
}: SpeechBubbleProps): ReactNode {
  const theme = useTheme();
  // Scheme-aware: in light mode the bubble pops above `background` as a
  // raised plate; in dark mode `surfaceElevated` gives the same "lifted
  // callout" feel without inverting to the light palette.
  const bubbleSurface = theme.colors.surfaceElevated;
  const lift = theme.elevation(2);
  const bubbleHeight =
    numberOfLines * BUBBLE_LINE_HEIGHT +
    2 * BUBBLE_PADDING_VERTICAL +
    (header !== undefined ? SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT : 0);
  const { opacity, translateX } = useBubbleEnterAnim(text);

  return (
    <Animated.View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        opacity,
        transform: [{ translateX }],
      }}
    >
      <View
        style={{
          width: TAIL_SIZE,
          height: TAIL_SIZE,
          backgroundColor: bubbleSurface,
          transform: [{ rotate: '45deg' }],
          marginRight: -TAIL_SIZE / 2,
        }}
      />
      <View
        style={{
          flex: 1,
          backgroundColor: bubbleSurface,
          borderRadius: borderRadius.md,
          paddingVertical: BUBBLE_PADDING_VERTICAL,
          paddingHorizontal: BUBBLE_PADDING_HORIZONTAL,
          height: bubbleHeight,
          justifyContent: 'center',
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
          ...(lift.elevation !== undefined ? { elevation: lift.elevation } : {}),
        }}
      >
        {header !== undefined ? header : null}
        {loading ? (
          <TypingDots
            color={theme.colors.textSecondary}
            height={BUBBLE_LINE_HEIGHT}
          />
        ) : (
          <Text
            variant="bodyBold"
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
            style={{
              color: theme.colors.text,
              lineHeight: BUBBLE_LINE_HEIGHT,
            }}
          >
            {text}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
