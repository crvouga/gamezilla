import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { BrandIcon } from './brand-icon';

export default function BrandIconExample() {
  return (
    <ExampleRoot>
      <Stack direction="horizontal" spacing={4} align="center">
        <BrandIcon name="google" size={20} />
        <BrandIcon name="google" size={32} />
        <BrandIcon name="google" size={48} />
      </Stack>
    </ExampleRoot>
  );
}
