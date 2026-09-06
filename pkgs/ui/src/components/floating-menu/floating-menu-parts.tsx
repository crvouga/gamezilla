/** @jsxImportSource solid-js */
/**
 * Rows inside {@link FloatingMenu}: header block, tappable item, divider.
 * Internal to the menu; only the content spec types are public.
 */

import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Box } from '../box';
import { Clickable } from '../clickable';
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
        variant={props.variant}
        numberOfLines={1}
        sx={props.muted === true ? { color: 'textSecondary' } : undefined}
        label={props.value}
      />
    </Show>
  );
}

export function FloatingMenuHeader(props: {
  header: FloatingMenuHeaderSpec;
}): JSX.Element {
  return (
    <Box
      role="presentation"
      dataSet={{ component: 'FloatingMenuHeader' }}
      sx={{
        px: 3,
        pb: 2,
        borderBottomWidth: 1,
        borderColor: 'border',
        gap: 0.5,
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {props.header.avatar}
        <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
          <HeaderLine value={props.header.title} variant="bodyBold" />
          <Show when={props.header.subtitle !== undefined}>
            <HeaderLine value={props.header.subtitle} variant="caption" muted />
          </Show>
        </Box>
      </Box>
    </Box>
  );
}

export function FloatingMenuDivider(): JSX.Element {
  return (
    <Box
      role="separator"
      sx={{ height: 1, background: 'border', my: 1 }}
      dataSet={{ component: 'FloatingMenuDivider' }}
    />
  );
}

export function FloatingMenuItem(props: {
  row: FloatingMenuItemRow;
  onSelect: (row: FloatingMenuItemRow) => void;
}): JSX.Element {
  return (
    <Clickable
      role="menuitem"
      aria-label={props.row['aria-label']}
      disabled={props.row.disabled ?? false}
      onClick={() => props.onSelect(props.row)}
      dataSet={{ component: 'FloatingMenuItem', ...props.row.dataSet }}
      sx={[
        {
          py: 3,
          px: 3,
          minHeight: FLOATING_MENU_ITEM_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          textAlign: 'left',
        },
        props.row.disabled === true && { opacity: 0.45 },
      ]}
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
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text variant="body" label={props.row.label} numberOfLines={1} />
        <Show when={props.row.subtitle !== undefined}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={props.row.subtitle}
            numberOfLines={1}
          />
        </Show>
      </Box>
      {props.row.trailing}
    </Clickable>
  );
}
