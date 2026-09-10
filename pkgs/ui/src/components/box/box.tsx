/** @jsxImportSource solid-js */
/**
 * `Box` -- the foundational layout primitive.
 *
 * A flex-column `<div>` (or any element via `as`) that accepts Solid
 * `class` / `classList` / `style` for layout and theming.
 *
 * @example
 * ```tsx
 * <Box class="p-4 bg-surface rounded-lg">
 *   <Text label="Hello" />
 * </Box>
 * ```
 */

import { type JSX, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
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

export type BoxProps = Omit<JSX.HTMLAttributes<HTMLElement>, 'children'> & {
  /** Host element. Defaults to `div`. */
  as?: BoxElement | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/** Box props for components that always render a `<div>`. */
export type DivBoxProps = Omit<BoxProps, 'ref'> &
  Pick<JSX.HTMLAttributes<HTMLDivElement>, 'ref'>;

export function joinClass(...parts: (string | false | undefined)[]): string {
  let out = '';
  for (const part of parts) {
    if (part) out = out === '' ? part : out + ' ' + part;
  }
  return out;
}

export function Box(props: BoxProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'as',
    'dataSet',
    'class',
    'style',
    'children',
  ]);
  return (
    <Dynamic
      component={local.as ?? 'div'}
      class={joinClass(styles['box'], local.class)}
      style={local.style}
      {...componentDataAttrs('Box', local.dataSet)}
      {...rest}
    >
      {local.children}
    </Dynamic>
  );
}
