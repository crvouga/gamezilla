import { Text } from '../text';
import { Stack } from '../stack';
import { Card } from '../card';
import { Skeleton } from './skeleton';
import { ExampleRoot } from '../explorer/example-root';

export default function SkeletonExample() {
  return (
    <ExampleRoot>
      <Text variant="heading" label="Skeleton" />

      <Stack spacing={2}>
        <Text variant="label" label="Text lines" />
        <Skeleton width="80%" height={16} />
        <Skeleton width="100%" height={16} />
        <Skeleton width="60%" height={16} />
      </Stack>

      <Text variant="label" label="Card placeholder" />
      <Card elevation={1} sx={{ p: 4 }}>
        <Stack direction="horizontal" spacing={3} align="center">
          <Skeleton width={48} height={48} borderRadius={24} />
          <Stack spacing={2} sx={{ flex: 1 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="80%" height={12} />
          </Stack>
        </Stack>
      </Card>
    </ExampleRoot>
  );
}
