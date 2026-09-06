/** @jsxImportSource solid-js */
/**
 * Internal `SpeechBubble` -- rounded surface plate with a small
 * left-pointing tail. Used by {@link SpeakingAvatar}.
 *
 * Two body states swap inside the same fixed-height surface, so neither
 * change reflows anything above or below:
 *
 *   - `loading=true` -> three-dot "typing" indicator (`./typing-dots.tsx`).
 *   - `loading=false` -> the full message rendered as `Text`.
 *
 * Entrance animation: the whole bubble (tail + surface together) slides in
 * from the left and fades in whenever `text` changes (CSS keyframes; the
 * bubble is keyed on `text` so the animation restarts per message).
 *
 * Layout-shift lockdown: the bubble has a *fixed* height derived from
 * `numberOfLines * BUBBLE_LINE_HEIGHT + 2 * BUBBLE_PADDING_VERTICAL` and the
 * inner `Text` clamps to `numberOfLines`, so messages of any length cannot
 * move anything that lives below the bubble.
 */

import { type JSX, Show } from 'solid-js';
import { useThemeTokens } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';
import styles from './speaking-avatar.module.css';
import { TypingDots } from './typing-dots';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
/** Matches `text.tsx`'s `bodyBold` `lineHeight`. */
const BUBBLE_LINE_HEIGHT = 26;
const DEFAULT_NUMBER_OF_LINES = 2;

export const SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT = 28;

export type SpeechBubbleProps = {
  text: string;
  /** Optional strip rendered above the message body (e.g. puzzle status). */
  header?: JSX.Element | undefined;
  /**
   * Number of lines reserved in the bubble. The bubble's height is pinned to
   * `numberOfLines * 26 + 24 px` (independent of `text`). Defaults to `2`.
   */
  numberOfLines?: number | undefined;
  /** When `true`, hides `text` and renders the typing dots. Defaults to `false`. */
  loading?: boolean | undefined;
};

export function SpeechBubble(props: SpeechBubbleProps): JSX.Element {
  const tokens = useThemeTokens();
  const lines = () => props.numberOfLines ?? DEFAULT_NUMBER_OF_LINES;
  const bubbleHeight = () =>
    lines() * BUBBLE_LINE_HEIGHT +
    2 * BUBBLE_PADDING_VERTICAL +
    (props.header !== undefined ? SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT : 0);
  const lift = tokens.elevation(2);

  // Keyed on the message so the CSS entrance restarts per message (a fresh
  // wrapper object per text value; `loading` swaps stay inside the bubble).
  return (
    <Show when={{ text: props.text }} keyed>
      {(_keyed) => (
        <Box
          class={styles['bubbleEnter']}
          data-component="SpeechBubble"
          sx={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: TAIL_SIZE,
              height: TAIL_SIZE,
              backgroundColor: 'surfaceElevated',
              transform: [{ rotate: '45deg' }],
              marginRight: -TAIL_SIZE / 2,
            }}
          />
          <Box
            sx={{
              flex: 1,
              backgroundColor: 'surfaceElevated',
              borderRadius: 'md',
              paddingVertical: BUBBLE_PADDING_VERTICAL,
              paddingHorizontal: BUBBLE_PADDING_HORIZONTAL,
              height: bubbleHeight(),
              justifyContent: 'center',
              ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
            }}
          >
            {props.header}
            <Show
              when={props.loading === true}
              fallback={
                <Text
                  variant="bodyBold"
                  numberOfLines={lines()}
                  sx={{ color: 'text', lineHeight: BUBBLE_LINE_HEIGHT }}
                  label={props.text}
                />
              }
            >
              <TypingDots color="textSecondary" height={BUBBLE_LINE_HEIGHT} />
            </Show>
          </Box>
        </Box>
      )}
    </Show>
  );
}
