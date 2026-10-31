/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { formatCompactNumber } from '../compact-number';
import type { IconComponent } from '../create-icon/index';

export type StatPillProps = {
  /** The count. */
  value: number;
  /** What is counted, after the number (`watching`, `points`). */
  label: JSX.Element;
  /** A glyph before the number. */
  icon?: IconComponent | undefined;
  /** The current one of a set: the soft tint instead of the sunken well. */
  active?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE = 16;

/**
 * `StatPill` -- one count and what it counts, in a round well: watchers,
 * players, points. From 1,000 the count is compact in the person's locale
 * (`12.4K`); the exact number stays on the element (`data-value`).
 *
 * An inactive pill is sunken (`surfaceMuted`) with the count in full ink and
 * the label muted. `active` marks the pill of whatever is current -- the
 * seat to move, the chosen stat -- with the soft tint (`tintSubtle` fill,
 * `onPrimarySoft` ink).
 *
 * @example
 * ```tsx
 * <StatPill value={12_400} label={t`watching`} icon={EyeIcon} />
 * <StatPill value={3} label={t`points`} active />
 * ```
 */
export function StatPill(props: StatPillProps): JSX.Element {
  const { i18n } = useLingui();
  const active = (): boolean => props.active === true;
  return (
    <span
      class="box inline-flex flex-row shrink-0 self-start items-center gap-1 rounded-full px-3 min-h-8 max-w-full"
      classList={{
        'bg-surface-muted': !active(),
        'bg-tint-subtle': active(),
      }}
      {...dataAttrs({ component: 'StatPill', ...props.dataSet })}
      data-value={String(props.value)}
      data-active={active() ? 'true' : undefined}
    >
      <Show when={props.icon}>
        {(icon) => (
          <Dynamic
            component={icon()}
            size={ICON_SIZE}
            color={active() ? 'onPrimarySoft' : 'textSecondary'}
          />
        )}
      </Show>
      <span
        class="text textLabel textNumeral whitespace-nowrap"
        classList={{ 'text-on-primary-soft': active(), 'text-text': !active() }}
      >
        {formatCompactNumber(props.value, i18n().locale)}
      </span>
      <span
        class="text textCaption truncate"
        classList={{ 'text-on-primary-soft': active() }}
      >
        {props.label}
      </span>
    </span>
  );
}
