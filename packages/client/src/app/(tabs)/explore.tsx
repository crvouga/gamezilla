import { Image } from 'expo-image';
import { Platform, type ImageStyle } from 'react-native';

import { useTheme } from '@gamezilla/shared/theme';
import { Box, Text, Collapsible } from '@gamezilla/shared/ui';
import { ExternalLink } from '@/ui/external-link';
import { IconSymbol } from '@/ui/icon-symbol';
import ParallaxScrollView from '@/ui/parallax-scroll-view';

export default function TabTwoScreen() {
  const theme = useTheme();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color={theme.colors.icon}
          name="chevron.left.forwardslash.chevron.right"
          style={theme.sx({ bottom: -90, left: -35, position: 'absolute' })}
        />
      }
    >
      <Box style={theme.sx({ flexDirection: 'row', gap: 2 })}>
        <Text
          variant="title"
          style={theme.sx({ fontFamily: theme.fonts.rounded })}
        >
          Explore
        </Text>
      </Box>
      <Text>
        This app includes example code to help you get started.
      </Text>
      <Collapsible title="File-based routing">
        <Text>
          This app has two screens:{' '}
          <Text variant="bodyBold">app/(tabs)/index.tsx</Text>{' '}
          and{' '}
          <Text variant="bodyBold">app/(tabs)/explore.tsx</Text>
        </Text>
        <Text>
          The layout file in{' '}
          <Text variant="bodyBold">app/(tabs)/_layout.tsx</Text>{' '}
          sets up the tab navigator.
        </Text>
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <Text variant="link">Learn more</Text>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Android, iOS, and web support">
        <Text>
          You can open this project on Android, iOS, and the web. To open the
          web version, press <Text variant="bodyBold">w</Text>{' '}
          in the terminal running this project.
        </Text>
      </Collapsible>
      <Collapsible title="Images">
        <Text>
          For static images, you can use the{' '}
          <Text variant="bodyBold">@2x</Text> and{' '}
          <Text variant="bodyBold">@3x</Text> suffixes to
          provide files for different screen densities
        </Text>
        <Image
          source={require('@/assets/images/react-logo.png')}
          style={
            theme.sx({
              width: 100,
              height: 100,
              alignSelf: 'center',
            }) as ImageStyle
          }
        />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <Text variant="link">Learn more</Text>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Light and dark mode components">
        <Text>
          This template has light and dark mode support. The{' '}
          <Text variant="bodyBold">useColorScheme()</Text> hook
          lets you inspect what the user&apos;s current color scheme is, and so
          you can adjust UI colors accordingly.
        </Text>
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <Text variant="link">Learn more</Text>
        </ExternalLink>
      </Collapsible>
      <Collapsible title="Animations">
        <Text>
          This template includes an example of an animated component. The{' '}
          <Text variant="bodyBold">
            components/HelloWave.tsx
          </Text>{' '}
          component uses the powerful{' '}
          <Text
            variant="bodyBold"
            style={theme.sx({ fontFamily: theme.fonts.mono })}
          >
            react-native-reanimated
          </Text>{' '}
          library to create a waving hand animation.
        </Text>
        {Platform.select({
          ios: (
            <Text>
              The{' '}
              <Text variant="bodyBold">
                components/ParallaxScrollView.tsx
              </Text>{' '}
              component provides a parallax effect for the header image.
            </Text>
          ),
        })}
      </Collapsible>
    </ParallaxScrollView>
  );
}
