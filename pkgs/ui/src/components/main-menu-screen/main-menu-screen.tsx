import type { ReactNode } from 'react';
import { adjustLightness } from '@pkgs/colors';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { useTheme, type Theme } from '../../theme';
import { formatCssHsla, parseCssColor } from '../../theme/colors/css-color';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { ButtonSurfaceFill } from '../button/button-surface-fill';
import { CircleCheckIcon, ChevronRightIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';
import { MainMenuScreenHeader } from './main-menu-screen-header';

export type MainMenuItem = {
  /** Stable id for list keys. */
  key: string;
  title: ReactNode;
  caption?: ReactNode;
  /** Overrides the default trailing affordance (chevron / selection check). */
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

export type MainMenuScreenProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Shown above the menu list (e.g. permissions hint). */
  helper?: ReactNode;
  items: readonly MainMenuItem[];
  /** Below the list (e.g. secondary actions). Back navigation should live in
   *  the host's nav chrome, not here. */
  footer?: ReactNode;
  /**
   * Stable screen identifier rendered as `data-screen` on the root (dev/e2e).
   * Prefer setting this for every top-level menu screen.
   */
  screenId?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const MENU_ITEM_MIN_HEIGHT = 84;
/** Shared max content width for every {@link MainMenuScreen}. */
export const MAIN_MENU_SCREEN_MAX_WIDTH = 480;
/** Lightness delta for the neutral top→bottom sheen (very subtle). */
const MENU_ITEM_GRADIENT_DELTA = 0.015;

function resolveNeutralGradient(surfaceCss: string): {
  top: string;
  bottom: string;
} {
  const source = parseCssColor(surfaceCss);
  if (source === null) {
    return { top: surfaceCss, bottom: surfaceCss };
  }
  return {
    top: formatCssHsla(adjustLightness(source, MENU_ITEM_GRADIENT_DELTA)),
    bottom: formatCssHsla(adjustLightness(source, -MENU_ITEM_GRADIENT_DELTA)),
  };
}

function mainMenuDefaultTrailing(
  theme: Theme,
  selected: boolean,
  interactive: boolean
): ReactNode | undefined {
  if (!interactive) {
    return undefined;
  }
  if (selected) {
    return (
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <CircleCheckIcon size={20} color={theme.colors.tint} />
        <ChevronRightIcon size={20} color={theme.colors.icon} />
      </Box>
    );
  }
  return <ChevronRightIcon size={20} color={theme.colors.icon} />;
}

function MainMenuItemBody({
  item,
  resolvedTrailing,
}: {
  item: MainMenuItem;
  resolvedTrailing: ReactNode | undefined;
}) {
  const theme = useTheme();
  const { title, caption, disabled = false } = item;
  const captionInTrailing = disabled && caption !== undefined;
  const gradient = resolveNeutralGradient(theme.colors.surfaceElevated);
  return (
    <Box
      sx={{
        py: 4,
        px: 4,
        minHeight: MENU_ITEM_MIN_HEIGHT,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
      style={{
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        overflow: 'hidden',
      }}
    >
      <ButtonSurfaceFill
        top={gradient.top}
        bottom={gradient.bottom}
        borderRadius={borderRadius.lg}
      />
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text variant="bodyBold" label={title} />
          {caption !== undefined && !captionInTrailing ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={caption}
            />
          ) : null}
        </Box>
        {captionInTrailing ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', fontStyle: 'italic' }}
            label={caption}
          />
        ) : (
          resolvedTrailing
        )}
      </Box>
    </Box>
  );
}

function MainMenuItemRow(item: MainMenuItem) {
  const theme = useTheme();
  const {
    trailing,
    selected = false,
    onPress,
    disabled = false,
    testID,
  } = item;

  const interactive = onPress !== undefined && !disabled;
  const defaultTrailing = mainMenuDefaultTrailing(theme, selected, interactive);
  const resolvedTrailing = trailing ?? defaultTrailing;

  if (onPress !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        {...(testID !== undefined ? { testID } : {})}
      >
        <MainMenuItemBody item={item} resolvedTrailing={resolvedTrailing} />
      </Pressable>
    );
  }

  return (
    <Box accessibilityRole="text" {...(testID !== undefined ? { testID } : {})}>
      <MainMenuItemBody item={item} resolvedTrailing={resolvedTrailing} />
    </Box>
  );
}

/**
 * Centered, card-based main menu: optional title/subtitle/helper, a vertical
 * stack of card rows, and an optional footer. Content is capped at
 * {@link MAIN_MENU_SCREEN_MAX_WIDTH} for visual consistency across all space
 * menus. Presentational; parents own selection and navigation state. Back
 * navigation belongs in the host's nav chrome (e.g. via `DefineBackButton` in
 * spaces), not inside the menu.
 */
export function MainMenuScreen({
  title,
  subtitle,
  helper,
  items,
  footer,
  screenId,
  dataSet,
}: MainMenuScreenProps): ReactNode {
  return (
    <Box
      {...componentDataSet('MainMenuScreen', {
        ...dataSet,
        ...(screenId !== undefined ? { screen: screenId } : {}),
      })}
      sx={{ px: 4, pb: 8, pt: 4, gap: 4, alignSelf: 'center' }}
      style={{ width: '100%', maxWidth: MAIN_MENU_SCREEN_MAX_WIDTH }}
    >
      <MainMenuScreenHeader title={title} subtitle={subtitle} />
      {helper ? (
        <Text
          variant="body"
          sx={{ color: 'textSecondary', textAlign: 'center', opacity: 0.75 }}
          label={helper}
        />
      ) : null}
      <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
        {items.map(({ key: itemKey, ...item }) => (
          <MainMenuItemRow key={itemKey} {...item} />
        ))}
      </Box>
      {footer ? <Box sx={{ mt: 2 }}>{footer}</Box> : null}
    </Box>
  );
}
