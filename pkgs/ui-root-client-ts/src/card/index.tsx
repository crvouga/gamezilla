/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';

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
 * The lower edge separates its contents from the canvas.
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
  const Tag = dynamic(() => props.as ?? 'section');
  return (
    <Tag
      id={props.id}
      tabindex={props.tabIndex}
      class="card gap-4 px-5 py-6 outline-none sm:px-8 sm:pt-8 sm:pb-7"
      {...dataAttrs({ component: 'Card', ...props.dataSet })}
    >
      {props.children}
    </Tag>
  );
}
