/** @jsxImportSource solid-js */
/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * Interactive rows (`onClick`) are `Clickable`s with `role="menuitem"` (host
 * them inside `MenuList`, which is `role="menu"`); hover / press tints come
 * from the default `'tint'` feedback. Static rows (key/value detail, rows
 * whose trailing control owns the interaction) are plain boxes. Pass
 * `selected` to opt into a `tintSubtle` row fill.
 *
 * @example
 * ```tsx
 * <MenuRow
 *   title="Appearance"
 *   caption="Light, dark, or system theme"
 *   onClick={() => router.push('/more/theme')}
 * />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { spacingScale } from '../../theme';
import { ChevronRightIcon } from '../icons';

export type MenuRowProps = {
  title: JSX.Element;
  caption?: JSX.Element | undefined;
  /** Rendered before the title (e.g. an icon or avatar). */
  leading?: JSX.Element | undefined;
  /**
   * Secondary value shown right-aligned before the chevron (e.g. `Dark`,
   * `1.2.0`). Use for key/value detail rows and current-choice rows.
   */
  value?: JSX.Element | undefined;
  /** Replace the default trailing chevron with custom content. */
  trailing?: JSX.Element | undefined;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean | undefined;
  /** Render the row in its "current selection" state. */
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: LocalizedString | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Every row shares one height so toggles, chevrons, and values line up. */
const MENU_ROW_MIN_HEIGHT = 60;
/**
 * Horizontal inset. Matches the shell edge padding `MenuList` cancels
 * (`CONTENT_EDGE_PADDING_STEP`) so row text lines up with sibling copy.
 */
export const MENU_ROW_PX_STEP = 4;
/** Minimum leading slot so 18–24px icons share one text column. */
const MENU_ROW_LEADING_WIDTH = 28;
/** Cap so a long value never crowds the title out of the row. */
const MENU_ROW_VALUE_MAX_WIDTH = '45%';

function MenuRowTrailing(props: {
  value: JSX.Element | undefined;
  trailing: JSX.Element | undefined;
  hideChevron: boolean;
  selected: boolean;
}): JSX.Element {
  const end = (): JSX.Element => (
    <Show
      when={props.trailing !== undefined}
      fallback={
        <Show when={!props.hideChevron}>
          <ChevronRightIcon
            size={20}
            color={props.selected ? 'tint' : 'icon'}
          />
        </Show>
      }
    >
      {props.trailing}
    </Show>
  );
  return (
    <Show
      when={props.value !== undefined && props.value !== null}
      fallback={end()}
    >
      <div
        class="box flex-row items-center gap-2"
        style={{ 'max-width': MENU_ROW_VALUE_MAX_WIDTH }}
      >
        <p class="text line-clamp-1 text-text-secondary text-right shrink">
          {props.value}
        </p>
        {end()}
      </div>
    </Show>
  );
}

function MenuRowBody(
  props: MenuRowProps & { interactive: boolean }
): JSX.Element {
  const selected = () => props.selected === true;
  return (
    <div
      class="box flex-row items-center py-3 gap-3"
      style={{
        'padding-left': `${spacingScale(MENU_ROW_PX_STEP)}px`,
        'padding-right': `${spacingScale(MENU_ROW_PX_STEP)}px`,
        'min-height': `${MENU_ROW_MIN_HEIGHT}px`,
      }}
    >
      <Show when={props.leading !== undefined}>
        <div
          class="box items-center"
          style={{ 'min-width': `${MENU_ROW_LEADING_WIDTH}px` }}
        >
          {props.leading}
        </div>
      </Show>
      <div class="box flex-1 min-w-0 gap-0.5 items-start">
        <p
          class="text textBodyBold text-text"
          classList={{ 'text-tint': selected() }}
        >
          {props.title}
        </p>
        <Show when={props.caption}>
          <p class="text textCaption text-text-secondary">{props.caption}</p>
        </Show>
      </div>
      <MenuRowTrailing
        value={props.value}
        trailing={props.trailing}
        hideChevron={props.hideChevron === true || !props.interactive}
        selected={selected()}
      />
    </div>
  );
}

function rowClass(selected: boolean): string {
  return selected ? 'rounded-[10px] bg-tint-subtle' : 'rounded-[10px]';
}

export function MenuRow(props: MenuRowProps): JSX.Element {
  const selected = () => props.selected === true;
  return (
    <Show
      when={props.onClick}
      fallback={
        <div
          class={`box ${rowClass(selected())}`}
          {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
          aria-label={props['aria-label']}
        >
          <MenuRowBody {...props} interactive={false} />
        </div>
      }
    >
      {(onClick) => (
        <button
          class={`clickable clickableTint ${rowClass(selected())}`}
          {...dataAttrs({ component: 'MenuRow', ...props.dataSet })}
          type="button"
          role="menuitem"
          onClick={() => onClick()()}
          disabled={props.disabled === true}
          aria-label={props['aria-label']}
          aria-current={props.selected === true ? true : undefined}
          style={{ opacity: props.disabled === true ? 0.5 : 1 }}
        >
          <MenuRowBody {...props} interactive />
        </button>
      )}
    </Show>
  );
}
