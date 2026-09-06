/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import type { ElevationLevel } from '../../theme';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Card } from './card';

const LEVELS: readonly ElevationLevel[] = [0, 1, 2, 3, 4, 5];

export default function CardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <For each={LEVELS}>
            {(level) => (
              <Card elevation={level} sx={{ p: 4 }}>
                <Text variant="subtitle" label={`Elevation ${level}`} />
                <Text
                  variant="body"
                  sx={{ color: 'textSecondary' }}
                  label="Scheme-aware shadow + dark-mode surface lift"
                />
              </Card>
            )}
          </For>
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
