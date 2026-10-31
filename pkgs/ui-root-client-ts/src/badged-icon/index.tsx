/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Badge, type BadgeIntent } from '../badge/index';
import { formatCompactNumber } from '../compact-number';

export type BadgedIconProps = {
  /** The icon. */
  children: JSX.Element;
  /** A count, or a short mark; unset, empty or zero shows the bare icon. */
  badge?: number | string | undefined;
  /** Defaults to `brand`. */
  intent?: BadgeIntent | undefined;
};

/**
 * `BadgedIcon` -- an icon with a short count or mark over its top end (an
 * unread count on a bell). With a `badge` the box reserves room at its end,
 * so the mark never covers a label beside the icon.
 *
 * A number `badge` is a count: compact from 1,000 in the person's locale
 * (`12.4K`), and zero shows the bare icon. A string is shown as given (`99+`).
 * The count is decoration: say it in the accessible name of the control the
 * icon sits in.
 *
 * @example
 * ```tsx
 * <BadgedIcon badge={unread()}>
 *   <BellIcon size={24} />
 * </BadgedIcon>
 * ```
 */
export function BadgedIcon(props: BadgedIconProps): JSX.Element {
  const { i18n } = useLingui();
  const text = (): string => {
    const badge = props.badge;
    if (typeof badge === 'number') {
      return badge === 0 ? '' : formatCompactNumber(badge, i18n().locale);
    }
    return badge ?? '';
  };
  const hasBadge = (): boolean => text().length > 0;
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
            label={text()}
            intent={props.intent ?? 'brand'}
            tone="solid"
            size="sm"
          />
        </span>
      </Show>
    </span>
  );
}
