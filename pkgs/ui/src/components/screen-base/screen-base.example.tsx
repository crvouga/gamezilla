import { Box } from '../box';
import { Text } from '../text';
import { ScreenBase } from './screen-base';
import { ExampleRoot } from '../explorer/example-root';

export default function ScreenBaseExample() {
  return (
    <ExampleRoot sx={{ flex: 1, minHeight: 400 }}>
      <ScreenBase
        screenId="screen-base-example"
        breadcrumbs={[
          { name: 'Design system', onPress: () => {} },
          { name: 'ScreenBase' },
        ]}
        actions={[
          { type: 'secondary', label: 'Secondary', onPress: () => {} },
          { type: 'submit', label: 'Primary', onPress: () => {} },
        ]}
        scroll
        content={({ sx }) => (
          <Box style={sx}>
            <Text
              variant="body"
              label="Body content uses fixed padding and max width from ScreenBase."
            />
          </Box>
        )}
      />
    </ExampleRoot>
  );
}
