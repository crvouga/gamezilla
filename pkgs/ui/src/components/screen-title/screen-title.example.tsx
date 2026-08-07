import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { ScreenBase } from '../screen-base';
import { Text } from '../text';

export default function ScreenTitleExample() {
  return (
    <ExampleRoot sx={{ flex: 1, minHeight: 400 }}>
      <ScreenBase
        screenId="screen-title-example"
        largeTitle
        breadcrumbs={[
          { name: 'Design system', onPress: () => {} },
          { name: 'ScreenLargeTitle' },
        ]}
        scroll
        content={({ sx }) => (
          <Box style={sx} sx={{ gap: 3 }}>
            <Text
              variant="caption"
              label="Scroll down — the TopBar title appears after the large title leaves the top."
            />
            {Array.from({ length: 12 }, (_, i) => (
              <Text
                key={i}
                variant="body"
                label={`Scroll content line ${i + 1}`}
              />
            ))}
          </Box>
        )}
      />
    </ExampleRoot>
  );
}
