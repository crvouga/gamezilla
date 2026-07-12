import type { ReactNode } from 'react';
import { useTheme, type Theme } from '../../theme';
import { Box } from '../box';
import { Card } from '../card';
import { CircleCheckIcon, ChevronRightIcon } from '../icons';
import { Pressable } from '../pressable';
import { Text } from '../text';

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
};

const MENU_ITEM_MIN_HEIGHT = 84;

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
  const { title, caption, disabled = false } = item;
  const captionInTrailing = disabled && caption !== undefined;
  return (
    <Card
      elevation={0}
      sx={{
        py: 4,
        px: 4,
        minHeight: MENU_ITEM_MIN_HEIGHT,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
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
    </Card>
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
 * stack of card rows, and an optional footer. Width is constrained for
 * visual consistency across all space menus. Presentational; parents own
 * selection and navigation state. Back navigation belongs in the host's
 * nav chrome (e.g. via `DefineBackButton` in spaces), not inside the menu.
 */
export function MainMenuScreen({
  title,
  subtitle,
  helper,
  items,
  footer,
}: MainMenuScreenProps): ReactNode {
  const hasHeader = title !== undefined || subtitle !== undefined;
  return (
    <Box sx={{ px: 4, pb: 8, pt: 4, gap: 4 }}>
      {hasHeader ? (
        <Box sx={{ gap: 2, alignItems: 'center', minHeight: 112 }}>
          {title ? (
            <Text variant="title" sx={{ textAlign: 'center' }} label={title} />
          ) : null}
          {subtitle ? (
            <Text
              variant="body"
              sx={{
                color: 'textSecondary',
                textAlign: 'center',
                opacity: 0.75,
              }}
              label={subtitle}
            />
          ) : null}
        </Box>
      ) : null}
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
