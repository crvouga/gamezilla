import {
  Box,
  CommandPaletteTrigger,
  Pressable,
  Text,
  useBreakpoint,
} from '@gamezilla/shared/ui';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountMenu } from '@/ui/account-menu';

/** Fixed content height below the status inset (with or without subtitle). */
const BAR_CONTENT_HEIGHT = 58;
/** Reserve space so centered title clears back / trailing actions. */
const TITLE_SIDE_GUTTER = 80;

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /**
   * When set, shows Back using the **current** navigator’s history, then
   * `router.replace(fallbackHref)` if there is no stack history (e.g. reload).
   */
  fallbackHref?: Href;
  /** Trailing control (e.g. destructive action). Sits on the right of the bar. */
  end?: ReactNode;
  /**
   * On mobile, shows the account avatar menu on the right (desktop uses the shell sidebar).
   */
  showAccountMenu?: boolean;
};

/**
 * App-wide top bar: same chrome everywhere (tabs, stacks, todos). Fixed
 * height below the status bar; centered title; optional subtitle on the line
 * below. Back / trailing controls stay vertically centered on the full bar.
 */
export function ScreenHeader({
  title,
  subtitle,
  fallbackHref,
  end,
  showAccountMenu = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMobile = useBreakpoint() === 'mobile';

  const accountEnd =
    showAccountMenu && isMobile ? (
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <CommandPaletteTrigger />
        <AccountMenu variant="header" />
      </Box>
    ) : undefined;
  const resolvedEnd = end ?? accountEnd;

  const showBack = fallbackHref !== undefined;
  const hasSubtitle = subtitle !== undefined && subtitle !== '';

  const onBackPress = () => {
    if (fallbackHref === undefined) return;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  return (
    <Box
      sx={{
        background: 'paper',
        borderBottomWidth: 1,
        borderColor: 'border',
        paddingTop: insets.top,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: BAR_CONTENT_HEIGHT,
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            alignSelf: 'stretch',
            paddingHorizontal: TITLE_SIDE_GUTTER,
            gap: 0.5,
          }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            variant="navigationTitle"
            sx={{ textAlign: 'center' }}
            label={title}
          />
          {hasSubtitle ? (
            <Text
              variant="caption"
              numberOfLines={2}
              ellipsizeMode="tail"
              sx={{ textAlign: 'center' }}
              label={subtitle}
            />
          ) : null}
        </Box>

        {showBack ? (
          <Pressable
            onPress={onBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            sx={{
              position: 'absolute',
              left: 12,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Text variant="label" sx={{ color: 'tint' }} label="Back" />
          </Pressable>
        ) : null}

        {resolvedEnd !== undefined && resolvedEnd !== null ? (
          <Box
            sx={{
              position: 'absolute',
              right: 8,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 2,
              maxWidth: 200,
            }}
          >
            {resolvedEnd}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
