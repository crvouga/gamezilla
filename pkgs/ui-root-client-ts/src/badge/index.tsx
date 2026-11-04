/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import type { StatusDotStatus } from '../status-dot/index';
import { StatusDot } from '../status-dot/index';

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
  /** A status dot before the label (`online`, `offline`, …). */
  dot?: StatusDotStatus | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const DOT_SIZE = 6;
/** A status tag's dot is drawn in the tag's own ink. */
const INK_DOT = 'currentColor';

function BadgeHost(props: {
  intent: BadgeIntent | 'live';
  tone: BadgeTone;
  size: BadgeSize;
  invisible: boolean;
  dot: JSX.Element | undefined;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <span
      // Not a `.box`: that host reset (`padding: 0`, later in the same layer)
      // would strip the pill's own padding.
      class="badge inline-flex shrink-0 self-start items-center justify-center min-w-0 max-w-full"
      classList={{
        invisible: props.invisible,
        'gap-1': props.dot !== undefined,
      }}
      aria-hidden={props.invisible ? true : undefined}
      {...dataAttrs({
        component: 'Badge',
        intent: props.intent,
        tone: props.tone,
        size: props.size,
        ...props.dataSet,
      })}
    >
      {props.dot}
      <span class="text whitespace-nowrap truncate">{props.label}</span>
    </span>
  );
}

/**
 * `Badge` -- a tag: one short fact, or a count.
 *
 * One family: every tag is the pill (`skin.css` `.badge`), 24px tall (`md`)
 * with the `label` text style (12/16 bold, tabular numerals) and a
 * sentence-case label; `sm` is 16px tall, for a count over an icon or a
 * dense row of tags. A label too long for its row ends in an ellipsis. Only
 * the tone changes: `subtle` (the default) is the intent's wash with its
 * colored label, for every status and fact; `solid` is the intent's fill
 * with its on-color, for counts. `brand` (tint) is for what is new or
 * chosen; `neutral` for plain facts.
 *
 * Three tags are fixed, so every screen says them the same way:
 * - {@link HostBadge}: `Host`, a neutral tag.
 * - {@link CurrentBadge}: `Current`, the brand wash with a dot: the space
 *   open on this device.
 * - {@link LiveBadge}: `Live`, the red wash with a dot: a space under way.
 *   The only use of the `live` intent.
 *
 * @example
 * ```tsx
 * <Badge label="New" intent="success" />
 * <Badge label="3" intent="brand" tone="solid" size="sm" />
 * <Badge label="Away" intent="neutral" dot="offline" />
 * <HostBadge />
 * <CurrentBadge />
 * <LiveBadge />
 * ```
 *
 * `dot` leads the label with a {@link StatusDot}: a presence pill.
 */
export function Badge(props: BadgeProps): JSX.Element {
  return (
    <BadgeHost
      intent={props.intent ?? 'brand'}
      tone={props.tone ?? 'subtle'}
      size={props.size ?? 'md'}
      invisible={props.invisible === true}
      dot={
        props.dot === undefined ? undefined : (
          <StatusDot status={props.dot} size={DOT_SIZE} />
        )
      }
      label={props.label}
      dataSet={props.dataSet}
    />
  );
}

export type FixedBadgeProps = {
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** `Live`: a space under way, on the red wash with a dot in its ink. */
export function LiveBadge(props: FixedBadgeProps): JSX.Element {
  return (
    <BadgeHost
      intent="live"
      tone="subtle"
      size="md"
      invisible={false}
      dot={<StatusDot color={INK_DOT} size={DOT_SIZE} />}
      label={<Trans>Live</Trans>}
      dataSet={props.dataSet}
    />
  );
}

/** `Current`: the space open on this device, the brand wash with a dot. */
export function CurrentBadge(props: FixedBadgeProps): JSX.Element {
  return (
    <BadgeHost
      intent="brand"
      tone="subtle"
      size="md"
      invisible={false}
      dot={<StatusDot color={INK_DOT} size={DOT_SIZE} />}
      label={<Trans>Current</Trans>}
      dataSet={props.dataSet}
    />
  );
}

/** `Host`: who runs the space, as a neutral tag. */
export function HostBadge(
  props: FixedBadgeProps & {
    /** Size preset. Defaults to `"md"`. */
    size?: BadgeSize | undefined;
  }
): JSX.Element {
  return (
    <Badge
      label={<Trans>Host</Trans>}
      intent="neutral"
      size={props.size}
      dataSet={props.dataSet}
    />
  );
}
