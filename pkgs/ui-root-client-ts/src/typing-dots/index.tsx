/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `TypingDots` -- chat "..." indicator. Three static dots (no keyframe loop).
 */

import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { For, type JSX } from 'solid-js';
import styles from '../speaking-avatar/speaking-avatar.module.css';
import { useThemeTokens } from '../theme-context/index';

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
            class="box rounded-full"
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
