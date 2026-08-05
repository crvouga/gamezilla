import { Box } from '../box';
import { Card } from '../card';
import { Divider } from '../divider';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';
import { HouseIcon } from '../icons';
import { EmptyState } from './empty-state';

export default function EmptyStateExample() {
  return (
    <ExampleRoot>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Fill" />
      <SchemePreview>
        <Box style={{ height: 280 }}>
          <EmptyState
            icon={HouseIcon}
            title="No live spaces"
            body="Tap + New space to start one."
            action={{ label: '+ New space', onPress: () => {} }}
          />
        </Box>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Compact, no icon"
      />
      <SchemePreview>
        <Card elevation={0}>
          <EmptyState
            variant="compact"
            title="No matching commands"
            body="Try a different search term."
          />
        </Card>
      </SchemePreview>

      <Divider />

      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Title only (list footer)"
      />
      <SchemePreview>
        <Card elevation={0}>
          <EmptyState variant="compact" title="No rows match filter." />
        </Card>
      </SchemePreview>
    </ExampleRoot>
  );
}
