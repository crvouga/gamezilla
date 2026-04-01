import { Box } from '../box';
import { Text } from '../text';
import { Collapsible } from './collapsible';

export default function CollapsibleExample() {
  return (
    <Box sx={{ p: 4, gap: 2 }}>
      <Text variant="heading">Collapsible</Text>

      <Collapsible title="Default (closed)">
        <Text variant="body">
          This content is hidden by default and revealed when the header is tapped.
        </Text>
      </Collapsible>

      <Collapsible title="Starts open" defaultOpen>
        <Text variant="body">
          This section starts in the expanded state.
        </Text>
      </Collapsible>

      <Collapsible title="Multiple items">
        <Box sx={{ gap: 2 }}>
          <Text variant="body">Item 1</Text>
          <Text variant="body">Item 2</Text>
          <Text variant="body">Item 3</Text>
        </Box>
      </Collapsible>

      <Collapsible
        title="Custom icon"
        renderIcon={(isOpen) => (
          <Text variant="body">{isOpen ? '▼' : '▶'}</Text>
        )}
      >
        <Text variant="body">Custom chevron icons via renderIcon prop.</Text>
      </Collapsible>
    </Box>
  );
}
