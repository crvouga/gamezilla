/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Box } from '../box';
import { Card } from '../card';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { LoadingState } from './loading-state';

export default function LoadingStateExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Fill (default)"
      />
      <SchemePreview>
        <Box sx={{ height: 240 }}>
          <LoadingState size="large" />
        </Box>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="With caption"
      />
      <SchemePreview>
        <Box sx={{ height: 240 }}>
          <LoadingState caption="Loading workspace…" />
        </Box>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Compact (inside a card)"
      />
      <SchemePreview>
        <Card elevation={1}>
          <LoadingState
            variant="compact"
            caption="Waiting for metrics from server…"
          />
        </Card>
      </SchemePreview>
    </ExampleRoot>
  );
}
