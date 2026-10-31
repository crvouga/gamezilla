/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { SpaceToken } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';

export type SpacerProps = {
  /** A fixed step along the main axis. Unset, the spacer grows. */
  size?: SpaceToken | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const SIZE: Readonly<Record<SpaceToken, string>> = {
  none: 'basis-ui-none',
  xs: 'basis-ui-xs',
  sm: 'basis-ui-sm',
  md: 'basis-ui-md',
  lg: 'basis-ui-lg',
  xl: 'basis-ui-xl',
  '2xl': 'basis-ui-2xl',
  '3xl': 'basis-ui-3xl',
};

function spacerClass(size: SpaceToken | undefined): string {
  return size === undefined
    ? 'box flex-1'
    : `box grow-0 shrink-0 ${SIZE[size]}`;
}

/**
 * `Spacer` -- empty room inside a `Stack*`. Unsized, it claims the space its
 * siblings leave (pushing the next child to the far end); with `size` it is
 * a fixed step along the parent's main axis and never grows or shrinks.
 *
 * Prefer `gap` for even spacing and `justify="between"` for two ends; reach
 * for a spacer when one break in a row differs from the rest.
 *
 * @example
 * ```tsx
 * <StackHorizontal align="center" gap="sm">
 *   <BackIconButton … />
 *   <Spacer />
 *   <IconButton … />
 * </StackHorizontal>
 * ```
 */
export function Spacer(props: SpacerProps): JSX.Element {
  return (
    <div
      class={spacerClass(props.size)}
      data-testid={props.testId}
      data-component={componentId('Spacer')}
      data-size={props.size}
      aria-hidden="true"
    />
  );
}
