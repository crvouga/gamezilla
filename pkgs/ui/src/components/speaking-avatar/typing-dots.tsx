/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `TypingDots` -- chat "..." indicator. The three dots pulse in sequence via
 * CSS keyframes (static under `prefers-reduced-motion`).
 */

import { For, type JSX } from 'solid-js';
import { resolveColor, useThemeTokens } from '../../theme';
import styles from './speaking-avatar.module.css';

const DOT_SIZE = 6;
const DOT_GAP_STEP = 1;
const DEFAULT_HEIGHT = 26;

export type TypingDotsProps = {
  /** Dot fill color (token or CSS). */
  readonly color: string;
  /** Container height in px. Defaults to a single body-text line (26). */
  readonly height?: number | undefined;
};

const DOT_CLASSES = [styles['dot1'], styles['dot2'], styles['dot3']];

export function TypingDots(props: TypingDotsProps): JSX.Element {
  const tokens = useThemeTokens();
  const fill = (): string =>
    resolveColor(props.color, tokens.colors) ?? props.color;
  return (
    <div
      class="box flex-row items-center"
      style={{
        gap: `${DOT_GAP_STEP * 4}px`,
        height: cssPx(props.height ?? DEFAULT_HEIGHT),
      }}
      role="status"
      aria-busy="true"
      data-component="TypingDots"
    >
      <For each={DOT_CLASSES}>
        {(dotClass) => (
          <div
            class="box rounded-[9999px]"
            classList={{
              [String(styles['dot'])]: true,
              [String(dotClass)]: true,
            }}
            style={{
              'background-color': fill(),
              width: cssPx(DOT_SIZE),
              height: cssPx(DOT_SIZE),
            }}
          />
        )}
      </For>
    </div>
  );
}
