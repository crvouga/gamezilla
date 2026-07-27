import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Card } from './card';

export default function CardExample() {
  return (
    <ExampleRoot>
      <Text variant="heading" label="Card" />

      <SchemePreview>
        <Stack spacing={3}>
          {([0, 1, 2, 3, 4, 5] as const).map((level) => (
            <Card key={level} elevation={level} sx={{ p: 4 }}>
              <Text variant="subtitle" label={`Elevation ${level}`} />
              <Text
                variant="body"
                sx={{ color: 'textSecondary' }}
                label={`Scheme-aware shadow + dark-mode surface lift`}
              />
            </Card>
          ))}
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
