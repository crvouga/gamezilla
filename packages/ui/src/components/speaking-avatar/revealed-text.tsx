/**
 * `RevealedText` -- a `<Text>` whose glyphs fade in one-by-one over a
 * configurable total duration.
 *
 * Why this implementation over the previous timer-based reveal:
 *
 *   1. Zero React state updates during the animation -- the full text is
 *      rendered on first paint (layout fixed for the whole duration) and
 *      each glyph's `opacity` is driven off a single shared
 *      `Animated.Value` via `interpolate`. One commit, then the animation
 *      runs entirely through `Animated`.
 *   2. Only `opacity` changes, which the browser composites without
 *      layout/paint per frame.
 *   3. {@link FADE_OVERLAP_CHARS} adjacent glyphs are mid-fade at any
 *      instant, so the visible "edge" of revealed text moves continuously
 *      instead of stepping per character.
 *
 * Layout: the outer `<Text>` is pinned to an explicit `lineHeight` and
 * `numberOfLines` with `ellipsizeMode="tail"`. Callers reserve a fixed
 * height upstream (`numberOfLines * lineHeight + padding`) and this
 * component cannot grow past it -- overflow is clipped with `…`. That
 * keeps anything below the caller (e.g. a chess board) from shifting
 * when `text` changes.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { Text } from '../text';

/** Floor for the total reveal duration (very short messages still ease in). */
const MIN_REVEAL_MS = 250;
/**
 * Each glyph fades over this many per-character durations. Values >1
 * produce overlapping fades so adjacent glyphs visibly bleed into each
 * other rather than popping in -- this is what turns "per-character
 * reveal" from a stutter into a continuous wave.
 */
const FADE_OVERLAP_CHARS = 4;

export type RevealedTextProps = {
  /** Text to reveal one glyph at a time. */
  readonly text: string;
  /** Color of the text glyphs. */
  readonly color: string;
  /** Lines reserved before truncation. Caller pins the height upstream. */
  readonly numberOfLines: number;
  /**
   * Per-character cadence in ms used as a *fallback* when
   * {@link RevealedTextProps.revealDurationMs} is `undefined`. The total
   * reveal duration is roughly `text.length * charDelayMs`, floored at
   * {@link MIN_REVEAL_MS}.
   */
  readonly charDelayMs: number;
  /**
   * Override total reveal duration -- pass when you want the reveal to
   * finish in lockstep with an external clock (e.g. TTS audio). `undefined`
   * means "compute from `charDelayMs`".
   */
  readonly revealDurationMs: number | undefined;
  /** Explicit text line height. Pinned so layout matches across platforms. */
  readonly lineHeight: number;
};

export function RevealedText({
  text,
  color,
  numberOfLines,
  charDelayMs,
  revealDurationMs,
  lineHeight,
}: RevealedTextProps): ReactNode {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    if (text.length === 0) return;
    const duration =
      revealDurationMs ?? Math.max(MIN_REVEAL_MS, text.length * charDelayMs);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [text, charDelayMs, revealDurationMs, progress]);

  const chars = useMemo(() => Array.from(text), [text]);
  const N = chars.length;
  // Width of each glyph's fade window as a fraction of total progress.
  // With FADE_OVERLAP_CHARS=4, four neighbouring glyphs are mid-fade at
  // any moment, which is what removes the per-char step.
  const fadeWidth = N > 0 ? Math.min(1, FADE_OVERLAP_CHARS / N) : 0;

  return (
    <Text
      variant="bodyBold"
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
      style={{ color, lineHeight }}
    >
      {chars.map((char, i) => {
        const start = i / N;
        const end = Math.min(1, start + fadeWidth);
        const opacity = progress.interpolate({
          inputRange: [start, end],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });
        return (
          <Animated.Text key={i} style={{ opacity }}>
            {char}
          </Animated.Text>
        );
      })}
    </Text>
  );
}
