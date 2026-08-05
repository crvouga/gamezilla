import { Box } from '../box';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { ErrorState } from './error-state';

export default function ErrorStateExample() {
  return (
    <ExampleRoot>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Fill (full-screen failure)"
      />
      <SchemePreview>
        <Box style={{ height: 280 }}>
          <ErrorState
            title="Playground failed to start"
            body="UnknownDatabaseError: cannot open snapshot at /tmp/db.sqlite"
            retry={{ label: 'Try again', onPress: () => {} }}
          />
        </Box>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Compact (inline card)"
      />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Failed to load metrics"
          body="HTTP 503 — server temporarily unavailable"
        />
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Compact with retry"
      />
      <SchemePreview>
        <ErrorState
          variant="compact"
          title="Sync failed"
          body="Could not apply 3 pending patches"
          retry={{ onPress: () => {} }}
        />
      </SchemePreview>
    </ExampleRoot>
  );
}
