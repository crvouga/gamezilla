/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { TypingDots } from '../typing-dots/index';

/** Matches the body role's leading (`--ui-leading-base`). */
const BUBBLE_LINE_HEIGHT = 24;
const DEFAULT_NUMBER_OF_LINES = 2;

export type SpeechBubbleProps = {
  text: string;
  /** Optional strip rendered above the message body (e.g. puzzle status). */
  header?: JSX.Element | undefined;
  /**
   * Minimum number of lines reserved in the bubble. Longer text expands it.
   * Defaults to `2`.
   */
  numberOfLines?: number | undefined;
  /**
   * The bubble never grows past `numberOfLines`: longer words are cut short
   * on screen (a listener still hears them whole), so what sits under the
   * bubble (a board) never moves when the words change.
   */
  fixedHeight?: boolean | undefined;
  /** When `true` and no text is available, renders the typing dots. Defaults to `false`. */
  loading?: boolean | undefined;
};

/** Words stay readable while speech loads. The live region remains mounted
 * as messages change; its minimum height reserves space without truncating
 * words, and shorter words sit in its middle, level with the speaker. */
export function SpeechBubble(props: SpeechBubbleProps): JSX.Element {
  const lines = () => props.numberOfLines ?? DEFAULT_NUMBER_OF_LINES;
  const messageHeight = () => `${lines() * BUBBLE_LINE_HEIGHT}px`;

  return (
    <div class="box flex-1 flex-row items-center" data-component="SpeechBubble">
      <div
        class="box size-3 -me-2 rotate-45 bg-surface-muted"
        aria-hidden="true"
      />
      <div class="box flex-1 rounded-card bg-surface-muted px-4 py-3">
        <Show when={props.header !== undefined}>
          <div class="box min-h-9 justify-center">{props.header}</div>
        </Show>
        <div
          class="box shrink-0 justify-center"
          style={{ 'min-height': messageHeight() }}
        >
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
                  ...(props.fixedHeight === true
                    ? {
                        display: '-webkit-box',
                        '-webkit-box-orient': 'vertical',
                        '-webkit-line-clamp': String(lines()),
                        overflow: 'hidden',
                      }
                    : {}),
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
    </div>
  );
}
