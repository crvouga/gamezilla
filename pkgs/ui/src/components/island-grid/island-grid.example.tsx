import { ExampleRoot } from '../explorer/example-root';
import { Island } from '../island';
import { Text } from '../text';
import { IslandGrid } from './island-grid';

export default function IslandGridExample() {
  return (
    <ExampleRoot>
      <IslandGrid columns={3}>
        <Island span={1} title="Identity">
          <Text variant="body" label="Avatar + username" />
        </Island>
        <Island span={2} title="Friends">
          <Text variant="body" label="Friends stats and actions" />
        </Island>
      </IslandGrid>
    </ExampleRoot>
  );
}
