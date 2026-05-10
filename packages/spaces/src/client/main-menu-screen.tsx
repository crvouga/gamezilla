import {
  Box,
  Card,
  IconButton,
  IconSymbol,
  Pressable,
  Text,
  useTheme,
  type Theme,
} from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

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
  /** Top-left back affordance for space menu flow. */
  onPressBack?: () => void;
  /** Below the list (e.g. back / secondary actions). */
  footer?: ReactNode;
};

const MENU_MAX_WIDTH = 640;
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
        <IconSymbol
          name="check.circle.fill"
          size={20}
          color={theme.colors.tint}
        />
        <IconSymbol name="chevron.right" size={20} color={theme.colors.icon} />
      </Box>
    );
  }
  return (
    <IconSymbol name="chevron.right" size={20} color={theme.colors.icon} />
  );
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

const MENU_BACK_BUTTON_SIZE = 40;
const MENU_BACK_ROW_PADDING_TOP = 12;
const MENU_BACK_ROW_PADDING_HORIZONTAL = 12;

/**
 * Always reserves space for the back button row so the menu layout does not
 * shift when {@link onPressBack} toggles between defined/undefined. The icon
 * itself is only rendered when a handler is provided.
 */
function MenuBackButtonRow({ onPressBack }: { onPressBack?: () => void }) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box
      style={{
        alignSelf: 'stretch',
        alignItems: 'flex-start',
        height: MENU_BACK_BUTTON_SIZE + MENU_BACK_ROW_PADDING_TOP,
        paddingTop: MENU_BACK_ROW_PADDING_TOP,
        paddingHorizontal: MENU_BACK_ROW_PADDING_HORIZONTAL,
      }}
    >
      {onPressBack ? (
        <IconButton
          size={MENU_BACK_BUTTON_SIZE}
          background="surface"
          onPress={onPressBack}
          accessibilityLabel={t`Back`}
        >
          <IconSymbol
            name="chevron.right"
            size={20}
            color={theme.colors.text}
            style={{ transform: [{ scaleX: -1 }] }}
          />
        </IconButton>
      ) : null}
    </Box>
  );
}

function MainMenuContent({
  title,
  subtitle,
  helper,
  items,
  footer,
}: {
  title: ReactNode | undefined;
  subtitle: ReactNode | undefined;
  helper: ReactNode | undefined;
  items: readonly MainMenuItem[];
  footer: ReactNode | undefined;
}) {
  const hasHeader = title !== undefined || subtitle !== undefined;
  return (
    <Box
      sx={{
        alignSelf: 'center',
        maxWidth: MENU_MAX_WIDTH,
        px: 4,
        pb: 8,
        pt: 4,
        gap: 4,
      }}
      style={{ width: '100%' }}
    >
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

/**
 * Centered, card-based main menu: optional title/subtitle/helper, a vertical
 * stack of card rows, and an optional footer. Width is constrained for visual
 * consistency across all space menus. Presentational; parents own selection
 * and navigation state.
 */
export function MainMenuScreen({
  title,
  subtitle,
  helper,
  items,
  onPressBack,
  footer,
}: MainMenuScreenProps): ReactNode {
  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <MenuBackButtonRow {...(onPressBack ? { onPressBack } : {})} />
      <MainMenuContent
        title={title}
        subtitle={subtitle}
        helper={helper}
        items={items}
        footer={footer}
      />
    </Box>
  );
}
