import { Box } from '../box';
import { Text } from '../text';
import { Center } from './center';

export default function CenterExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Center</Text>

      <Center sx={{ height: 120, background: 'surface', borderRadius: 8 }}>
        <Text variant="body">Centered content</Text>
      </Center>

      <Center
        sx={{
          height: 120,
          background: 'tint',
          borderRadius: 12,
        }}
      >
        <Text variant="bodyBold" sx={{ color: 'paper' }}>
          Centered on tint
        </Text>
      </Center>
    </Box>
  );
}
