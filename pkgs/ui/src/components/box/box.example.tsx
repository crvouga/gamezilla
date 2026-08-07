import { Text } from 'react-native';
import { useTheme } from '../../theme';
import { ExampleRoot } from '../explorer/example-root';
import { Box } from './box';

export default function BoxExample() {
  const theme = useTheme();

  return (
    <ExampleRoot>
      <Text
        style={theme.sx({ color: 'text', fontSize: 'lg', fontWeight: 'bold' })}
      >
        Box
      </Text>

      <Box sx={{ p: 4, background: 'surface', borderRadius: 8 }}>
        <Text style={theme.sx({ color: 'text' })}>Surface background</Text>
      </Box>

      <Box
        sx={{
          p: 4,
          background: 'surface',
          borderWidth: 1,
          borderColor: 'border',
          borderRadius: 12,
        }}
      >
        <Text style={theme.sx({ color: 'text' })}>With border</Text>
      </Box>

      <Box
        sx={{
          p: 4,
          background: 'tint',
          borderRadius: 8,
        }}
      >
        <Text style={theme.sx({ color: 'onPrimary', fontWeight: '600' })}>
          Tint background
        </Text>
      </Box>

      <Box sx={{ flexDirection: 'row', gap: 2 }}>
        <Box sx={{ flex: 1, p: 3, background: 'surface', borderRadius: 8 }}>
          <Text style={theme.sx({ color: 'text', fontSize: 'sm' as const })}>
            Flex 1
          </Text>
        </Box>
        <Box sx={{ flex: 2, p: 3, background: 'surface', borderRadius: 8 }}>
          <Text style={theme.sx({ color: 'text', fontSize: 'sm' as const })}>
            Flex 2
          </Text>
        </Box>
      </Box>
    </ExampleRoot>
  );
}
