import { Text } from '../text';
import { Center } from './center';
import { ExampleRoot } from '../explorer/example-root';

export default function CenterExample() {
  return (
    <ExampleRoot>
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
        <Text
          variant="bodyBold"
          sx={{ color: 'onTint' }}
          label="Centered on tint"
        />
      </Center>
    </ExampleRoot>
  );
}
