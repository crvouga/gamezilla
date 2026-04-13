import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';

const BAR_MIN_HEIGHT = 44;
/** Horizontal inset so centered title never runs under the back affordance. */
const TITLE_SIDE_GUTTER = 80;

export type StackScreenHeaderProps = {
  title: string;
  /**
   * Route when this stack has no history (e.g. full reload). Not used when
   * `navigation.canGoBack()` is true for the **current** navigator.
   */
  fallbackHref: Href;
};

/**
 * Stack title + back control using design-system UI only (replaces React
 * Navigation stack headers). Title stays visually centered; Back floats on the
 * left. Uses the **local** stack for goBack; `fallbackHref` only after reload.
 */
export function StackScreenHeader({
  title,
  fallbackHref,
}: StackScreenHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onBackPress = () => {
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
          minHeight: BAR_MIN_HEIGHT,
          justifyContent: 'center',
        }}
      >
        <Text
          variant="navigationTitle"
          numberOfLines={1}
          sx={{ textAlign: 'center' }}
          style={{
            paddingHorizontal: TITLE_SIDE_GUTTER,
          }}
        >
          {title}
        </Text>

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
      </Box>
    </Box>
  );
}
