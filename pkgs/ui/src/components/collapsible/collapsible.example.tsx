import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { Collapsible } from './collapsible';

export default function CollapsibleExample() {
  return (
    <ExampleRoot sx={{ gap: 2 }}>
      <Collapsible title="Default (closed)">
        <Text
          variant="body"
          label="This content is hidden by default and revealed when the header is tapped."
        />
      </Collapsible>

      <Collapsible title="Starts open" defaultOpen>
        <Text
          variant="body"
          label="This section starts in the expanded state."
        />
      </Collapsible>

      <Collapsible title="Multiple items">
        <Box sx={{ gap: 2 }}>
          <Text variant="body" label="Item 1" />
          <Text variant="body" label="Item 2" />
          <Text variant="body" label="Item 3" />
        </Box>
      </Collapsible>

      <Collapsible
        title="Custom icon"
        renderIcon={(isOpen) => (
          <Text variant="body" label={isOpen ? '▼' : '▶'} />
        )}
      >
        <Text
          variant="body"
          label="Custom chevron icons via renderIcon prop."
        />
      </Collapsible>
    </ExampleRoot>
  );
}
