import { Stack } from '../stack';
import { Text } from '../text';
import { BrandIcon } from './brand-icon';
import { ExampleRoot } from '../explorer/example-root';

export default function BrandIconExample() {
  return (
    <ExampleRoot>
      <Text variant="heading" label="BrandIcon" />

      <Stack direction="horizontal" spacing={4} align="center">
        <BrandIcon name="google" size={20} />
        <BrandIcon name="google" size={32} />
        <BrandIcon name="google" size={48} />
      </Stack>
    </ExampleRoot>
  );
}
