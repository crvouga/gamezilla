/** @jsxImportSource solid-js */
/**
 * `TypingDots` -- chat "..." indicator. The three dots pulse in sequence via
 * CSS keyframes (static under `prefers-reduced-motion`).
 */

import { For, type JSX } from 'solid-js';
import { Box } from '../box';
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
  return (
    <Box
      role="status"
      aria-busy="true"
      data-component="TypingDots"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: DOT_GAP_STEP,
        height: props.height ?? DEFAULT_HEIGHT,
      }}
    >
      <For each={DOT_CLASSES}>
        {(dotClass) => (
          <Box
            class={`${styles['dot']} ${dotClass}`}
            sx={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: 'full',
              backgroundColor: props.color,
            }}
          />
        )}
      </For>
    </Box>
  );
}
