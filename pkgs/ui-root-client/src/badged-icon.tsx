/** @jsxImportSource solid-js */
/**
 * `BadgedIcon` -- an icon with a short count or mark over its top end (an
 * unread count on a bell). With a `badge` the box reserves room at its end,
 * so the mark never covers a label beside the icon.
 *
 * The count is decoration: say it in the accessible name of the control the
 * icon sits in.
 *
 * @example
 * ```tsx
 * <BadgedIcon badge={count() > 0 ? String(count()) : undefined}>
 *   <BellIcon size={24} />
 * </BadgedIcon>
 * ```
 */

import { componentId } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { Badge, type BadgeIntent } from './badge';

export type BadgedIconProps = {
  /** The icon. */
  children: JSX.Element;
  /** Short count or mark; unset (or empty) shows the bare icon. */
  badge?: string | undefined;
  /** Defaults to `brand`. */
  intent?: BadgeIntent | undefined;
};

export function BadgedIcon(props: BadgedIconProps): JSX.Element {
  const hasBadge = (): boolean =>
    props.badge !== undefined && props.badge.length > 0;
  return (
    <span
      class="box relative shrink-0"
      classList={{ 'pr-3': hasBadge() }}
      data-component={componentId('BadgedIcon')}
    >
      {props.children}
      <Show when={hasBadge()}>
        <span class="box absolute -top-1 right-0" aria-hidden="true">
          <Badge
            label={props.badge}
            intent={props.intent ?? 'brand'}
            tone="solid"
            size="sm"
          />
        </span>
      </Show>
    </span>
  );
}
