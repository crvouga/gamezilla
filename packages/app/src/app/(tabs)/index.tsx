import { Image } from 'expo-image';
import { Platform, type ImageStyle } from 'react-native';

import { HelloWave } from '@/ui/hello-wave';
import ParallaxScrollView from '@/ui/parallax-scroll-view';
import { useTheme } from '@gamezilla/shared/theme';
import { Box, Text } from '@gamezilla/shared/ui';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={
            theme.sx({
              height: 178,
              width: 290,
              bottom: 0,
              left: 0,
              position: 'absolute',
            }) as ImageStyle
          }
        />
      }
    >
      <Box
        style={theme.sx({ flexDirection: 'row', alignItems: 'center', gap: 2 })}
      >
        <Text variant="title">Welcome!</Text>
        <HelloWave />
      </Box>
      <Box style={theme.sx({ gap: 2, mb: 2 })}>
        <Text variant="subtitle">Step 1: Try it</Text>
        <Text>
          Edit <Text variant="bodyBold">app/(tabs)/index.tsx</Text> to see
          changes. Press{' '}
          <Text variant="bodyBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </Text>{' '}
          to open developer tools.
        </Text>
      </Box>
      <Box style={theme.sx({ gap: 2, mb: 2 })}>
        <Link href="/modal">
          <Link.Trigger>
            <Text variant="subtitle">Step 2: Explore</Text>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              title="Action"
              icon="cube"
              onPress={() => alert('Action pressed')}
            />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <Text>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </Text>
      </Box>
      <Box style={theme.sx({ gap: 2, mb: 2 })}>
        <Text variant="subtitle">Step 3: Get a fresh start</Text>
        <Text>
          {`When you're ready, run `}
          <Text variant="bodyBold">npm run reset-project</Text> to get a fresh{' '}
          <Text variant="bodyBold">app</Text> directory. This will move the
          current <Text variant="bodyBold">app</Text> to{' '}
          <Text variant="bodyBold">app-example</Text>.
        </Text>
      </Box>
    </ParallaxScrollView>
  );
}
