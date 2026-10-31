/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

export type CardElement = 'div' | 'section' | 'main' | 'article';

export type CardProps = {
  children: JSX.Element;
  /** Host element. Defaults to `section`. */
  as?: CardElement | undefined;
  id?: string | undefined;
  tabIndex?: number | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `Card` -- a raised (`surface`) box inside one hairline that holds one
 * self-contained unit of content (a form step, a summary, a settings group).
 * Flat: no shadow, no gradient. Children stack with `gap-4`.
 *
 * Pick the host element for the landmark the card is: `as="main"` for the
 * page's one primary card, `section` (the default) otherwise. `id` and
 * `tabIndex` let a caller move focus to the card itself.
 *
 * @example
 * ```tsx
 * <Card as="main" id="screen" tabIndex={-1}>
 *   <h1 class="text textHeading">{t`Sign in`}</h1>
 * </Card>
 * ```
 */
export function Card(props: CardProps): JSX.Element {
  return (
    <Dynamic
      component={props.as ?? 'section'}
      id={props.id}
      tabIndex={props.tabIndex}
      class="box gap-4 rounded-card border border-border bg-surface px-5 py-6 outline-none sm:px-8 sm:pt-8 sm:pb-7"
      {...dataAttrs({ component: 'Card', ...props.dataSet })}
    >
      {props.children}
    </Dynamic>
  );
}
