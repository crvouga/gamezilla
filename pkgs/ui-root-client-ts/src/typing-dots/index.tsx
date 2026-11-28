/** @jsxImportSource @solidjs/web */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `TypingDots` -- chat "..." indicator. Three static dots (no keyframe loop).
 */

import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
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

const DOTS = [0, 1, 2];

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
      <For each={DOTS}>
        {() => (
          <div
            class="box rounded-full opacity-muted"
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
