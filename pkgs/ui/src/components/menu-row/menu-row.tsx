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
import type { ComponentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronRightIcon } from '../icons';
import { Text } from '../text';

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
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          maxWidth: MENU_ROW_VALUE_MAX_WIDTH,
        }}
      >
        <Text
          variant="body"
          numberOfLines={1}
          sx={{ color: 'textSecondary', textAlign: 'right', flexShrink: 1 }}
          label={props.value}
        />
        {end()}
      </Box>
    </Show>
  );
}

function MenuRowBody(
  props: MenuRowProps & { interactive: boolean }
): JSX.Element {
  const selected = () => props.selected === true;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        px: MENU_ROW_PX_STEP,
        py: 3,
        gap: 3,
        minHeight: MENU_ROW_MIN_HEIGHT,
      }}
    >
      <Show when={props.leading !== undefined}>
        <Box sx={{ minWidth: MENU_ROW_LEADING_WIDTH, alignItems: 'center' }}>
          {props.leading}
        </Box>
      </Show>
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5, alignItems: 'flex-start' }}>
        <Text
          variant="bodyBold"
          sx={selected() ? { color: 'tint' } : undefined}
          label={props.title}
        />
        <Show when={props.caption}>
          <Text variant="caption" label={props.caption} />
        </Show>
      </Box>
      <MenuRowTrailing
        value={props.value}
        trailing={props.trailing}
        hideChevron={props.hideChevron === true || !props.interactive}
        selected={selected()}
      />
    </Box>
  );
}

export function MenuRow(props: MenuRowProps): JSX.Element {
  const rowSx = (): SxProps => ({
    borderRadius: 'md',
    ...(props.selected === true ? { backgroundColor: 'tintSubtle' } : {}),
  });
  return (
    <Show
      when={props.onClick}
      fallback={
        <Box
          sx={rowSx()}
          aria-label={props['aria-label']}
          dataSet={{ component: 'MenuRow', ...props.dataSet }}
        >
          <MenuRowBody {...props} interactive={false} />
        </Box>
      }
    >
      {(onClick) => (
        <Clickable
          role="menuitem"
          onClick={() => onClick()()}
          disabled={props.disabled === true}
          aria-label={props['aria-label']}
          aria-current={props.selected === true ? true : undefined}
          sx={[rowSx(), { opacity: props.disabled === true ? 0.5 : 1 }]}
          dataSet={{ component: 'MenuRow', ...props.dataSet }}
        >
          <MenuRowBody {...props} interactive />
        </Clickable>
      )}
    </Show>
  );
}
