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
 * <Badge label="Live" intent="neutral" dot="online" />
 * ```
 *
 * `dot` leads the label with a {@link StatusDot}: a live or presence pill.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import type { StatusDotStatus } from './status-dot';
import { StatusDot } from './status-dot';

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
  /**
   * Keep the badge's box but paint and say nothing, so a value that arrives
   * later cannot reflow the row it sits in.
   */
  invisible?: boolean | undefined;
  /** A status dot before the label (`online` for a live pill). */
  dot?: StatusDotStatus | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Badge(props: BadgeProps): JSX.Element {
  return (
    <span
      // Not a `.box`: that host reset (`padding: 0`, later in the same layer)
      // would strip the pill's own padding.
      class="badge inline-flex shrink-0 self-start items-center justify-center"
      classList={{
        invisible: props.invisible === true,
        'gap-1': props.dot !== undefined,
      }}
      aria-hidden={props.invisible === true ? true : undefined}
      {...dataAttrs({
        component: 'Badge',
        intent: props.intent ?? 'brand',
        tone: props.tone ?? 'subtle',
        size: props.size ?? 'md',
        ...props.dataSet,
      })}
    >
      <Show when={props.dot}>
        {(status) => <StatusDot status={status()} size={6} />}
      </Show>
      <p class="text whitespace-nowrap">{props.label}</p>
    </span>
  );
}
