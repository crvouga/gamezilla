import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Badge } from './badge';

export default function BadgeExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Badge" />

      <Stack direction="horizontal" spacing={2} wrap>
        <Badge label="Default" />
        <Badge label="Success" color="success" />
        <Badge label="Warning" color="warning" />
        <Badge label="Error" color="destructive" />
        <Badge label="Info" color="info" />
      </Stack>

      <Stack direction="horizontal" spacing={2} align="center">
        <Badge label="3" color="destructive" size="sm" />
        <Badge label="99+" color="tint" size="sm" />
        <Badge label="New" color="success" />
      </Stack>
    </Box>
  );
}
