/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-shared/css-px';

/**
 * Rows inside {@link FloatingMenu}: header block, tappable item, divider.
 * Internal to the menu; only the content spec types are public.
 */

import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  FloatingMenuHeaderSpec,
  FloatingMenuItemRow,
} from './floating-menu-content';
import type { TextVariant } from './text';

/** Every menu row is at least this tall (pointer target). */
export const FLOATING_MENU_ITEM_MIN_HEIGHT = 44;

const ROW_ICON_SIZE = 18;

function isTexty(node: JSX.Element): node is string | number {
  return typeof node === 'string' || typeof node === 'number';
}

/** Prefer the authored label; never render a blank row. */
function resolveItemLabel(row: FloatingMenuItemRow): JSX.Element {
  const label = row.label;
  if (typeof label === 'string') {
    const trimmed = label.trim();
    if (trimmed.length > 0) return trimmed;
  } else if (typeof label === 'number') {
    return label;
  } else if (label !== null && label !== undefined && label !== false) {
    return label;
  }
  const aria = row['aria-label']?.trim();
  if (aria !== undefined && aria.length > 0) return aria;
  return row.id;
}

/**
 * Only an authored `aria-label` overrides the row's text: otherwise the name
 * comes from what the row shows (label and subtitle), so a listener hears the
 * visible label (WCAG 2.5.3, ACT 2ee8b8).
 */
function authoredAriaLabel(row: FloatingMenuItemRow): string | undefined {
  const aria = row['aria-label']?.trim();
  return aria !== undefined && aria.length > 0 ? aria : undefined;
}

/** Strings go through host text classes; component titles render as-is. */
function HeaderLine(props: {
  value: JSX.Element;
  variant: TextVariant;
  muted?: boolean | undefined;
}): JSX.Element {
  return (
    <Show when={isTexty(props.value)} fallback={props.value}>
      <p
        class="text line-clamp-1"
        classList={{
          textBodyBold: props.variant === 'bodyBold',
          textCaption: props.variant === 'caption',
          textLabel: props.variant === 'label',
          textTitle: props.variant === 'title',
          textSubtitle: props.variant === 'subtitle',
          textHeading: props.variant === 'heading',
          textNavigationTitle: props.variant === 'navigationTitle',
          textLink: props.variant === 'link',
          textMono: props.variant === 'mono',
          'text-text-secondary': props.muted === true,
        }}
      >
        {props.value}
      </p>
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
        <div class="box flex-1 min-w-0 gap-0.5">
          <HeaderLine value={props.header.title} variant="bodyBold" />
          <Show when={props.header.subtitle !== undefined}>
            <HeaderLine value={props.header.subtitle} variant="caption" muted />
          </Show>
        </div>
      </div>
      <Show when={props.header.badge !== undefined}>
        <div class="box flex-row pt-1">{props.header.badge}</div>
      </Show>
    </div>
  );
}

export function FloatingMenuDivider(): JSX.Element {
  return (
    <div
      class="box h-0.25 bg-border my-1"
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
      class="clickable clickableTint py-2 px-3 flex-row items-center gap-2 text-left"
      {...dataAttrs({ component: 'FloatingMenuItem', ...props.row.dataSet })}
      type="button"
      style={{
        ...(props.row.disabled === true ? { opacity: 0.45 } : {}),
        'min-height': cssPx(FLOATING_MENU_ITEM_MIN_HEIGHT),
      }}
      role="menuitem"
      aria-label={authoredAriaLabel(props.row)}
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
        <div class="box shrink-0 items-center justify-center w-4.5 h-4.5">
          {props.row.leading}
        </div>
      </Show>
      <p class="text textLabel line-clamp-1 flex-1 min-w-0">
        {resolveItemLabel(props.row)}
      </p>
      <Show when={props.row.subtitle !== undefined}>
        <p class="text textCaption line-clamp-1 text-text-secondary shrink-0 max-w-9/20 text-right">
          {props.row.subtitle}
        </p>
      </Show>
      {props.row.trailing}
    </button>
  );
}
