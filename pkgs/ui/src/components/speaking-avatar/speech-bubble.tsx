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
 * Layout-shift lockdown: the bubble has a *fixed* height derived from
 * `numberOfLines * BUBBLE_LINE_HEIGHT + 2 * BUBBLE_PADDING_VERTICAL` and the
 * inner `Text` clamps to `numberOfLines`, so messages of any length cannot
 * move anything that lives below the bubble.
 */

import { type JSX, Show } from 'solid-js';
import { TypingDots } from './typing-dots';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
/** Matches `text.tsx`'s `bodyBold` `lineHeight`. */
const BUBBLE_LINE_HEIGHT = 26;
const DEFAULT_NUMBER_OF_LINES = 2;

/** Must match coach status header row height (e.g. chess puzzle status). */
export const SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT = 22;

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
  const lines = () => props.numberOfLines ?? DEFAULT_NUMBER_OF_LINES;
  const bubbleHeight = () =>
    lines() * BUBBLE_LINE_HEIGHT +
    2 * BUBBLE_PADDING_VERTICAL +
    (props.header !== undefined ? SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT : 0);

  // Keyed on the message so the CSS entrance restarts per message (a fresh
  // wrapper object per text value; `loading` swaps stay inside the bubble).
  return (
    <Show when={{ text: props.text }} keyed>
      {(_keyed) => (
        <div
          class="box flex-1 flex-row items-center"
          data-component="SpeechBubble"
        >
          <div
            class="box bg-surface-muted rotate-45"
            style={{
              width: `${TAIL_SIZE}px`,
              height: `${TAIL_SIZE}px`,
              'margin-right': `${-TAIL_SIZE / 2}px`,
            }}
            aria-hidden="true"
          />
          <div
            class="box flex-1 bg-surface-muted rounded-control justify-start border border-solid border-border"
            style={{
              'padding-top': `${BUBBLE_PADDING_VERTICAL}px`,
              'padding-bottom': `${BUBBLE_PADDING_VERTICAL}px`,
              'padding-left': `${BUBBLE_PADDING_HORIZONTAL}px`,
              'padding-right': `${BUBBLE_PADDING_HORIZONTAL}px`,
              height: `${bubbleHeight()}px`,
            }}
          >
            {props.header}
            <Show
              when={props.loading === true}
              fallback={
                <p
                  class="text textBodyBold text-text"
                  style={{
                    'line-height': `${BUBBLE_LINE_HEIGHT}px`,
                    display: '-webkit-box',
                    '-webkit-box-orient': 'vertical',
                    '-webkit-line-clamp': lines(),
                    overflow: 'hidden',
                  }}
                >
                  {props.text}
                </p>
              }
            >
              <TypingDots color="textSecondary" height={BUBBLE_LINE_HEIGHT} />
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
