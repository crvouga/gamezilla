/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * Rows inside {@link FloatingMenu}: header block, tappable item, divider.
 * Internal to the menu; only the content spec types are public.
 */

import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { dataAttrs } from '../../component-id';
import { joinClass } from '../box';
import { Text, type TextVariant } from '../text';
import type {
  FloatingMenuHeaderSpec,
  FloatingMenuItemRow,
} from './floating-menu-content';

/** Every menu row is at least this tall (pointer target). */
export const FLOATING_MENU_ITEM_MIN_HEIGHT = 44;

const ROW_ICON_SIZE = 18;

function isTexty(node: JSX.Element): node is string | number {
  return typeof node === 'string' || typeof node === 'number';
}

/** Strings go through {@link Text}; component titles render as-is. */
function HeaderLine(props: {
  value: JSX.Element;
  variant: TextVariant;
  muted?: boolean | undefined;
}): JSX.Element {
  return (
    <Show when={isTexty(props.value)} fallback={props.value}>
      <Text
        as="p"
        variant={props.variant}
        class={joinClass(
          'line-clamp-1',
          props.muted === true ? 'text-text-secondary' : undefined
        )}
        numberOfLines={1}
      >
        {props.value}
      </Text>
    </Show>
  );
}

export function FloatingMenuHeader(props: {
  header: FloatingMenuHeaderSpec;
}): JSX.Element {
  return (
    <div
      class="box px-3 pb-2 border-b border-border gap-0.5"
      data-component="FloatingMenuHeader"
      role="presentation"
    >
      <div class="box flex-row items-center gap-2">
        {props.header.avatar}
        <div class="box flex-1 min-w-[0] gap-0.5">
          <HeaderLine value={props.header.title} variant="bodyBold" />
          <Show when={props.header.subtitle !== undefined}>
            <HeaderLine value={props.header.subtitle} variant="caption" muted />
          </Show>
        </div>
      </div>
    </div>
  );
}

export function FloatingMenuDivider(): JSX.Element {
  return (
    <div
      class="box h-[1px] bg-border my-1"
      data-component="FloatingMenuDivider"
      role="separator"
    />
  );
}

export function FloatingMenuItem(props: {
  row: FloatingMenuItemRow;
  onSelect: (row: FloatingMenuItemRow) => void;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint py-3 px-3 flex-row items-center gap-2 text-left"
      {...dataAttrs({ component: 'FloatingMenuItem', ...props.row.dataSet })}
      type="button"
      style={{
        ...(props.row.disabled === true ? { opacity: 0.45 } : {}),
        'min-height': cssPx(FLOATING_MENU_ITEM_MIN_HEIGHT),
      }}
      role="menuitem"
      aria-label={props.row['aria-label']}
      disabled={props.row.disabled ?? false}
      onClick={() => props.onSelect(props.row)}
    >
      <Show
        when={props.row.leading !== undefined}
        fallback={
          <Dynamic
            component={props.row.icon}
            size={ROW_ICON_SIZE}
            color="icon"
          />
        }
      >
        {props.row.leading}
      </Show>
      <div class="box flex-1 min-w-[0] gap-0.5">
        <p class="text line-clamp-1">{props.row.label}</p>
        <Show when={props.row.subtitle !== undefined}>
          <p class="text textCaption line-clamp-1 text-text-secondary">
            {props.row.subtitle}
          </p>
        </Show>
      </div>
      {props.row.trailing}
    </button>
  );
}
