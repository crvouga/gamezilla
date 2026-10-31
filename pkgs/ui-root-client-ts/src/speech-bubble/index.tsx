/** @jsxImportSource solid-js */

import { type JSX, Show } from 'solid-js';
import { TypingDots } from '../typing-dots/index';

const TAIL_SIZE = 12;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_PADDING_HORIZONTAL = 16;
/** Matches the body role's leading (`--ui-leading-base`). */
const BUBBLE_LINE_HEIGHT = 24;
const DEFAULT_NUMBER_OF_LINES = 2;

/** Minimum coach status header row height (e.g. chess puzzle status). */
export const SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT = 22;

export type SpeechBubbleProps = {
  text: string;
  /** Optional strip rendered above the message body (e.g. puzzle status). */
  header?: JSX.Element | undefined;
  /**
   * Minimum number of lines reserved in the bubble. Longer text expands it.
   * Defaults to `2`.
   */
  numberOfLines?: number | undefined;
  /** When `true` and no text is available, renders the typing dots. Defaults to `false`. */
  loading?: boolean | undefined;
};

/** Words stay readable while speech loads. The live region remains mounted
 * as messages change; its minimum height reserves space without truncating words. */
export function SpeechBubble(props: SpeechBubbleProps): JSX.Element {
  const lines = () => props.numberOfLines ?? DEFAULT_NUMBER_OF_LINES;
  const bubbleHeight = () =>
    lines() * BUBBLE_LINE_HEIGHT +
    2 * BUBBLE_PADDING_VERTICAL +
    (props.header !== undefined ? SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT : 0);

  return (
    <div class="box flex-1 flex-row items-center" data-component="SpeechBubble">
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
        class="box flex-1 bg-surface-muted rounded-card justify-start"
        style={{
          'padding-top': `${BUBBLE_PADDING_VERTICAL}px`,
          'padding-bottom': `${BUBBLE_PADDING_VERTICAL}px`,
          'padding-left': `${BUBBLE_PADDING_HORIZONTAL}px`,
          'padding-right': `${BUBBLE_PADDING_HORIZONTAL}px`,
          'min-height': `${bubbleHeight()}px`,
        }}
      >
        {props.header}
        <Show
          when={props.loading === true && props.text.trim().length === 0}
          fallback={
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              class="text text-text"
              style={{
                'line-height': `${BUBBLE_LINE_HEIGHT}px`,
                'overflow-wrap': 'anywhere',
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
  );
}
