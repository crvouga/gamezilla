/** @jsxImportSource solid-js */
/**
 * `Box` -- the foundational layout primitive.
 *
 * A flex-column `<div>` (or any element via `as`) that accepts an `sx` prop
 * for utility-first styling. Color tokens compile to `var(--ui-color-*)`.
 *
 * @example
 * ```tsx
 * <Box sx={{ p: 4, background: 'surface', borderRadius: 8 }}>
 *   <Text label="Hello" />
 * </Box>
 * ```
 */

import { type JSX, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { type SxInput, useThemeTokens } from '../../theme';
import styles from '../hosts.module.css';

export type BoxElement =
  | 'div'
  | 'section'
  | 'article'
  | 'nav'
  | 'header'
  | 'footer'
  | 'main'
  | 'aside'
  | 'ul'
  | 'li'
  | 'form'
  | 'label'
  | 'span';

export type BoxProps = Omit<
  JSX.HTMLAttributes<HTMLElement>,
  'style' | 'children'
> & {
  /** Host element. Defaults to `div`. */
  as?: BoxElement | undefined;
  /** Utility-first style shorthand resolved against the current theme. */
  sx?: SxInput | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** Extra class names (component-internal CSS Modules). */
  class?: string | undefined;
  ref?: ((el: HTMLElement) => void) | undefined;
  children?: JSX.Element | undefined;
};

export function joinClass(...parts: (string | false | undefined)[]): string {
  let out = '';
  for (const part of parts) {
    if (part) out = out === '' ? part : out + ' ' + part;
  }
  return out;
}

export function Box(props: BoxProps): JSX.Element {
  const tokens = useThemeTokens();
  const [local, rest] = splitProps(props, [
    'as',
    'sx',
    'dataSet',
    'class',
    'children',
  ]);
  return (
    <Dynamic
      component={local.as ?? 'div'}
      class={joinClass(styles['box'], local.class)}
      style={tokens.css(local.sx) || undefined}
      {...componentDataAttrs('Box', local.dataSet)}
      {...rest}
    >
      {local.children}
    </Dynamic>
  );
}
