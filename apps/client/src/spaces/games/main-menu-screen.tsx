import {
  Box,
  IconSymbol,
  MenuRow,
  Text,
  useTheme,
  type Theme,
} from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type MainMenuItem = {
  /** Stable id for list keys. */
  key: string;
  title: ReactNode;
  caption?: ReactNode;
  leading?: ReactNode;
  /** Overrides default trailing (selection check, disclosure). */
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  /** When true, show the disclosure chevron (e.g. submenu). Defaults to false. */
  showDisclosure?: boolean;
};

export type MainMenuScreenProps = {
  artwork?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Shown above the menu list (e.g. permissions hint). */
  helper?: ReactNode;
  items: readonly MainMenuItem[];
  /** Below the list (e.g. back / secondary actions). */
  footer?: ReactNode;
};

function mainMenuDefaultTrailing(
  theme: Theme,
  selected: boolean,
  showDisclosure: boolean
): ReactNode | undefined {
  if (selected) {
    return (
      <IconSymbol name="check.circle.fill" size={20} color={theme.colors.tint} />
    );
  }
  if (showDisclosure) {
    return (
      <IconSymbol name="chevron.right" size={20} color={theme.colors.icon} />
    );
  }
  return undefined;
}

function MainMenuInteractiveRow(
  item: MainMenuItem & { onPress: () => void },
  resolvedTrailing: ReactNode | undefined,
  hideChevron: boolean
) {
  const { title, caption, leading, onPress, disabled = false, testID } = item;
  return (
    <MenuRow
      {...(testID !== undefined ? { testID } : {})}
      title={title}
      caption={caption}
      leading={leading}
      trailing={resolvedTrailing}
      hideChevron={hideChevron}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

function MainMenuStaticRow({
  item,
  resolvedTrailing,
}: {
  item: MainMenuItem;
  resolvedTrailing: ReactNode | undefined;
}) {
  const { title, caption, leading, disabled = false, testID } = item;
  return (
    <Box
      accessibilityRole="text"
      {...(testID !== undefined ? { testID } : {})}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          py: 3,
          gap: 3,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {leading}
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text variant="bodyBold" label={title} />
          {caption ? <Text variant="caption" label={caption} /> : null}
        </Box>
        {resolvedTrailing}
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
    showDisclosure = false,
  } = item;

  const defaultTrailing = mainMenuDefaultTrailing(
    theme,
    selected,
    showDisclosure
  );
  const resolvedTrailing = trailing ?? defaultTrailing;
  const hideChevron = resolvedTrailing !== undefined;

  if (onPress !== undefined) {
    return MainMenuInteractiveRow(
      { ...item, onPress },
      resolvedTrailing,
      hideChevron
    );
  }

  return <MainMenuStaticRow item={item} resolvedTrailing={resolvedTrailing} />;
}

/**
 * Classic vertical main menu: header copy + tappable rows + optional footer.
 * Presentational; parents own selection and navigation state.
 */
export function MainMenuScreen({
  artwork,
  title,
  subtitle,
  helper,
  items,
  footer,
}: MainMenuScreenProps): ReactNode {
  return (
    <Box sx={{ alignSelf: 'stretch', gap: 3 }}>
      {artwork ? (
        <Box sx={{ alignItems: 'center', justifyContent: 'center' }}>{artwork}</Box>
      ) : null}
      {title ? <Text variant="heading" label={title} /> : null}
      {subtitle ? (
        <Text variant="body" sx={{ color: 'textSecondary' }} label={subtitle} />
      ) : null}
      {helper ? (
        <Text variant="body" sx={{ color: 'textSecondary' }} label={helper} />
      ) : null}
      <Box sx={{ alignSelf: 'stretch' }}>
        {items.map(({ key: itemKey, ...item }) => (
          <MainMenuItemRow key={itemKey} {...item} />
        ))}
      </Box>
      {footer}
    </Box>
  );
}
