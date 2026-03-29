import Animated from 'react-native-reanimated';

import { useTheme } from '@/@shared/theme';

export function HelloWave() {
  const theme = useTheme();

  return (
    <Animated.Text
      style={theme.sx({
        fontSize: 28,
        lineHeight: 32,
        marginTop: -6,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      })}
    >
      👋
    </Animated.Text>
  );
}
