import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';

/** Fixed content height below the status inset (with or without subtitle). */
const BAR_CONTENT_HEIGHT = 58;
/** Reserve space so centered title clears back / trailing actions. */
const TITLE_SIDE_GUTTER = 80;

export type TodoScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** When set, shows Back and calls this handler (e.g. navigation + fallback replace). */
  onBack?: () => void;
  end?: ReactNode;
};

/**
 * Top bar aligned with app `ScreenHeader` chrome, without expo-router.
 */
export function TodoScreenHeader({
  title,
  subtitle,
  onBack,
  end,
}: TodoScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const showBack = onBack !== undefined;
  const hasSubtitle = subtitle !== undefined && subtitle !== '';

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
            onPress={onBack}
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
