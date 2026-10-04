/** @jsxImportSource solid-js */
/**
 * Host prop types formerly shared by the peeled `Box` primitive.
 * Layout call sites now use HTML elements + Solid `class` / `classList`.
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';

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
