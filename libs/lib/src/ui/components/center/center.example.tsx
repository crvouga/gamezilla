import { Box } from '../box';
import { Text } from '../text';
import { Center } from './center';

export default function CenterExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Center" />

      <Center sx={{ height: 120, background: 'surface', borderRadius: 8 }}>
        <Text variant="body" label="Centered content" />
      </Center>

      <Center
        sx={{
          height: 120,
          background: 'tint',
          borderRadius: 12,
        }}
      >
        <Text variant="bodyBold" sx={{ color: 'surface' }} label="Centered on tint" />
      </Center>
    </Box>
  );
}
