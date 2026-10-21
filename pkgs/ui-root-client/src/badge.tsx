/** @jsxImportSource solid-js */
/**
 * `Badge` -- small status indicator or count label.
 *
 * A pill (`skin.css` `.badge`): 12px semibold, tabular numerals, 24px tall
 * (`md`) or 16px (`sm`, counts on an icon). `subtle` is the intent's wash
 * with its colored label; `solid` is the intent's fill with its on-color.
 * `brand` (blue) is for what is new or chosen; `neutral` for plain facts.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" size="sm" />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';

export type BadgeIntent =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export type BadgeTone = 'subtle' | 'solid';

export type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  /** Text displayed inside the badge. */
  label: JSX.Element;
  /** Semantic intent. Defaults to `"brand"`. */
  intent?: BadgeIntent | undefined;
  /** Visual weight. Defaults to `"subtle"`. */
  tone?: BadgeTone | undefined;
  /** Size preset. Defaults to `"md"`. */
  size?: BadgeSize | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Badge(props: BadgeProps): JSX.Element {
  return (
    <span
      // Not a `.box`: that host reset (`padding: 0`, later in the same layer)
      // would strip the pill's own padding.
      class="badge inline-flex shrink-0 self-start items-center justify-center"
      {...dataAttrs({
        component: 'Badge',
        intent: props.intent ?? 'brand',
        tone: props.tone ?? 'subtle',
        size: props.size ?? 'md',
        ...props.dataSet,
      })}
    >
      <p class="text whitespace-nowrap">{props.label}</p>
    </span>
  );
}
