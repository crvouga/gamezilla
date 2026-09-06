/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { Skeleton } from './skeleton';

export default function SkeletonExample(): JSX.Element {
  return (
    <ExampleRoot>
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
