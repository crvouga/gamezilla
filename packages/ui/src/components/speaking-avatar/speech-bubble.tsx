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
 *   - `loading=false` -> per-glyph opacity reveal (`./revealed-text.tsx`).
 *
 * Layout-shift lockdown: the bubble has a *fixed* `height` derived from
 * `numberOfLines * BUBBLE_LINE_HEIGHT + 2 * BUBBLE_PADDING_VERTICAL`. The
 * inner reveal is also clipped to `numberOfLines` with
 * `ellipsizeMode="tail"` and pinned to the same explicit `lineHeight`.
 * The result: messages of any length, dots/text swaps, and font-metric
 * drift across web/iOS/Android cannot move anything that lives below the
 * bubble (e.g. the chess board on `chess-puzzle-play-screen`).
 */

import { type ReactNode } from 'react';
import { View } from 'react-native';
import { defaultColors } from '../../theme';
import { borderRadius, elevation } from '../../theme/scale';
import { RevealedText } from './revealed-text';
import { TypingDots } from './typing-dots';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
/** Matches `text.tsx`'s `bodyBold` `lineHeight`. Pinned here so we can size the bubble deterministically. */
const BUBBLE_LINE_HEIGHT = 26;
/** Default lines reserved in the bubble; sized to cover typical coach copy without truncating. */
const DEFAULT_NUMBER_OF_LINES = 2;

export type SpeechBubbleProps = {
  text: string;
  /**
   * Per-character cadence in ms used as a *fallback* when no
   * {@link SpeechBubbleProps.revealDurationMs} is supplied. Defaults to
   * `30`.
   */
  charDelayMs?: number;
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
  /**
   * When set, overrides the char-based reveal duration so the typewriter
   * finishes in lockstep with TTS audio. Pass the player's reported
   * `durationMs`. Defaults to `undefined` (use `charDelayMs`).
   */
  revealDurationMs?: number;
};

export function SpeechBubble({
  text,
  charDelayMs = 30,
  numberOfLines = DEFAULT_NUMBER_OF_LINES,
  loading = false,
  revealDurationMs,
}: SpeechBubbleProps): ReactNode {
  // Keep the bubble visually "light" in both schemes: in dark mode we
  // intentionally invert to the light palette's surface/text so the bubble
  // reads as a callout against the dark backdrop instead of blending in.
  const bubbleSurface = defaultColors.light.surface;
  const bubbleHeight =
    numberOfLines * BUBBLE_LINE_HEIGHT + 2 * BUBBLE_PADDING_VERTICAL;

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
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
        style={[
          elevation(1),
          {
            flex: 1,
            backgroundColor: bubbleSurface,
            borderRadius: borderRadius.md,
            paddingVertical: BUBBLE_PADDING_VERTICAL,
            paddingHorizontal: BUBBLE_PADDING_HORIZONTAL,
            height: bubbleHeight,
            justifyContent: 'center',
          },
        ]}
      >
        {loading ? (
          <TypingDots
            color={defaultColors.light.textSecondary}
            height={BUBBLE_LINE_HEIGHT}
          />
        ) : (
          <RevealedText
            text={text}
            color={defaultColors.light.text}
            numberOfLines={numberOfLines}
            charDelayMs={charDelayMs}
            revealDurationMs={revealDurationMs}
            lineHeight={BUBBLE_LINE_HEIGHT}
          />
        )}
      </View>
    </View>
  );
}
