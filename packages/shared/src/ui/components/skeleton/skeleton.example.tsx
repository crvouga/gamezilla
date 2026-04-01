import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Card } from '../card';
import { Skeleton } from './skeleton';

export default function SkeletonExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Skeleton</Text>

      <Stack spacing={2}>
        <Text variant="label">Text lines</Text>
        <Skeleton width="80%" height={16} />
        <Skeleton width="100%" height={16} />
        <Skeleton width="60%" height={16} />
      </Stack>

      <Text variant="label">Card placeholder</Text>
      <Card elevation={1} sx={{ p: 4 }}>
        <Stack direction="horizontal" spacing={3} align="center">
          <Skeleton width={48} height={48} borderRadius={24} />
          <Stack spacing={2} sx={{ flex: 1 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="80%" height={12} />
          </Stack>
        </Stack>
      </Card>
    </Box>
  );
}
