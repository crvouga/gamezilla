/**
 * `MenuRow` -- a tappable navigation row with title, optional caption, and a
 * trailing disclosure chevron.
 *
 * Hover (web) and press tints come automatically from {@link Pressable}'s
 * default `'tint'` feedback. Pass `selected` to opt into a `tintSubtle` row
 * fill for "current section" / multi-select patterns.
 *
 * @example
 * ```tsx
 * <MenuRow
 *   title="Appearance"
 *   caption="Light, dark, or system theme"
 *   onPress={() => router.push('/more/theme')}
 * />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { releaseWebFocus } from '../../web/release-web-focus';
import { Box } from '../box';
import { ChevronRightIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type MenuRowProps = {
  title: ReactNode;
  caption?: ReactNode;
  /** Rendered before the title (e.g. an icon or avatar). */
  leading?: ReactNode;
  /**
   * Secondary value shown right-aligned before the chevron (e.g. `Dark`,
   * `1.2.0`). Use for key/value detail rows and current-choice rows.
   */
  value?: ReactNode;
  /** Replace the default trailing chevron with custom content. */
  trailing?: ReactNode;
  /** Hide the trailing disclosure chevron. Defaults to `false`. */
  hideChevron?: boolean;
  /** Render the row in its "current selection" state. */
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: LocalizedString;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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

function menuRowPressHandler(
  onPress: (() => void) | undefined
): (() => void) | undefined {
  if (onPress === undefined) return undefined;
  return () => {
    releaseWebFocus();
    onPress();
  };
}

function MenuRowTitle({
  title,
  selected,
}: {
  title: ReactNode;
  selected: boolean;
}): ReactNode {
  if (selected) {
    return <Text variant="bodyBold" sx={{ color: 'tint' }} label={title} />;
  }
  return <Text variant="bodyBold" label={title} />;
}

/** Cap so a long value never crowds the title out of the row. */
const MENU_ROW_VALUE_MAX_WIDTH = '45%';

function MenuRowTrailing({
  value,
  trailing,
  hideChevron,
  selected,
  tint,
  icon,
}: {
  value: ReactNode | undefined;
  trailing: ReactNode | undefined;
  hideChevron: boolean;
  selected: boolean;
  tint: string;
  icon: string;
}): ReactNode {
  const chevron = hideChevron ? null : (
    <ChevronRightIcon size={20} color={selected ? tint : icon} />
  );
  const end = trailing !== undefined ? trailing : chevron;
  if (value === undefined || value === null) return end;
  return (
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
        label={value}
      />
      {end}
    </Box>
  );
}

export function MenuRow({
  title,
  caption,
  leading,
  value,
  trailing,
  hideChevron = false,
  selected = false,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
  dataSet,
}: MenuRowProps) {
  const theme = useTheme();
  const interactive = onPress !== undefined;
  const body = (
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
      {leading !== undefined ? (
        <Box sx={{ minWidth: MENU_ROW_LEADING_WIDTH, alignItems: 'center' }}>
          {leading}
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <MenuRowTitle title={title} selected={selected} />
        {caption ? <Text variant="caption" label={caption} /> : null}
      </Box>
      <MenuRowTrailing
        value={value}
        trailing={trailing}
        hideChevron={hideChevron || !interactive}
        selected={selected}
        tint={theme.colors.tint}
        icon={theme.colors.icon}
      />
    </Box>
  );
  const rowSx = {
    borderRadius: borderRadius.md,
    ...(selected ? { backgroundColor: 'tintSubtle' as const } : {}),
  };

  // Static rows (key/value detail, toggles that own their own control) must
  // not pick up hover / press tint, so they are plain boxes.
  if (!interactive) {
    return (
      <Box
        sx={rowSx}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        dataSet={{ component: 'MenuRow', ...dataSet }}
      >
        {body}
      </Box>
    );
  }

  return (
    <Pressable
      onPress={menuRowPressHandler(onPress)}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      sx={{ ...rowSx, opacity: disabled ? 0.5 : 1 }}
      dataSet={{ component: 'MenuRow', ...dataSet }}
    >
      {body}
    </Pressable>
  );
}
