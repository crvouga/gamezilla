import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Box } from './box';

export default function BoxExample() {
  return (
    <ExampleRoot>
      <Text variant="heading" sx={{ fontSize: 'lg' }} label="Box" />

      <Box sx={{ p: 4, background: 'surface', borderRadius: 8 }}>
        <Text sx={{ color: 'text' }} label="Surface background" />
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
        <Text sx={{ color: 'text' }} label="With border" />
      </Box>

      <Box
        sx={{
          p: 4,
          background: 'tint',
          borderRadius: 8,
        }}
      >
        <Text
          sx={{ color: 'onPrimary', fontWeight: '600' }}
          label="Tint background"
        />
      </Box>

      <Box sx={{ flexDirection: 'row', gap: 2 }}>
        <Box sx={{ flex: 1, p: 3, background: 'surface', borderRadius: 8 }}>
          <Text sx={{ color: 'text', fontSize: 'sm' }} label="Flex 1" />
        </Box>
        <Box sx={{ flex: 2, p: 3, background: 'surface', borderRadius: 8 }}>
          <Text sx={{ color: 'text', fontSize: 'sm' }} label="Flex 2" />
        </Box>
      </Box>
    </ExampleRoot>
  );
}
