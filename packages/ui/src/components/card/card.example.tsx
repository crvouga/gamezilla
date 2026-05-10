import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Card } from './card';

export default function CardExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Card" />

      {([0, 1, 2, 3, 4] as const).map((level) => (
        <Card key={level} elevation={level} sx={{ p: 4 }}>
          <Text variant="subtitle" label={`Elevation ${level}`} />
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={`Card content with shadow level ${level}`}
          />
        </Card>
      ))}

      <Card elevation={0} sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Text variant="subtitle" label="Flat card (border, no shadow)" />
          <Text variant="caption" label="elevation=0 uses a border instead" />
        </Stack>
      </Card>
    </Box>
  );
}
