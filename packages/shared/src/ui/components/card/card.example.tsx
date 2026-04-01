import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Card } from './card';

export default function CardExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Card</Text>

      {([0, 1, 2, 3, 4] as const).map((level) => (
        <Card key={level} elevation={level} sx={{ p: 4 }}>
          <Text variant="subtitle">Elevation {level}</Text>
          <Text variant="body" sx={{ color: 'textSecondary' }}>
            Card content with shadow level {level}
          </Text>
        </Card>
      ))}

      <Card elevation={0} sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Text variant="subtitle">Flat card (border, no shadow)</Text>
          <Text variant="caption">elevation=0 uses a border instead</Text>
        </Stack>
      </Card>
    </Box>
  );
}
