import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';

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
}: ScreenHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const showBack = fallbackHref !== undefined;
  const hasSubtitle = subtitle !== undefined && subtitle !== '';

  const onBackPress = () => {
    if (fallbackHref === undefined) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
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
          >
            {title}
          </Text>
          {hasSubtitle ? (
            <Text
              variant="caption"
              numberOfLines={2}
              ellipsizeMode="tail"
              sx={{ textAlign: 'center' }}
            >
              {subtitle}
            </Text>
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
            <Text variant="label" sx={{ color: 'tint' }}>
              Back
            </Text>
          </Pressable>
        ) : null}

        {end !== undefined && end !== null ? (
          <Box
            sx={{
              position: 'absolute',
              right: 8,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 2,
              maxWidth: 140,
            }}
          >
            {end}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

/** @deprecated Use `ScreenHeader` */
export const StackScreenHeader = ScreenHeader;
