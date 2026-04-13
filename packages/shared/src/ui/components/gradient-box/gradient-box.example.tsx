import { Text as RNText } from 'react-native';
import { useTheme } from '../../theme';
import { Box } from '../box/box';
import { Text } from '../text/text';
import { GradientBox } from './gradient-box';

export default function GradientBoxExample() {
  const theme = useTheme();

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <RNText
        style={theme.sx({ color: 'text', fontSize: 'lg', fontWeight: 'bold' })}
      >
        GradientBox
      </RNText>

      <Text variant="caption" sx={{ color: 'textSecondary' }}>
        Default horizontal gradient uses theme gradientPrimaryStart →
        gradientPrimaryEnd.
      </Text>

      <GradientBox
        sx={{ p: 4, borderRadius: 16, minHeight: 88, justifyContent: 'center' }}
      >
        <Text variant="bodyBold" sx={{ color: '#FFFFFF' }}>
          Primary gradient card
        </Text>
        <Text variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
          Rounded, padded surface
        </Text>
      </GradientBox>

      <GradientBox
        colors={['#4F46E5', '#7C3AED', '#DB2777']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        sx={{ p: 4, borderRadius: 12 }}
      >
        <Text variant="bodyBold" sx={{ color: '#FFFFFF' }}>
          Custom stops (diagonal)
        </Text>
      </GradientBox>
    </Box>
  );
}
