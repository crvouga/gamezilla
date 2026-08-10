import { useTimers } from '@pkgs/clock';
import { useCallback } from 'react';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import { PullToRefreshControl } from './pull-to-refresh-control';
import { usePullToRefresh } from './use-pull-to-refresh';

function PullToRefreshDemo() {
  const timers = useTimers();
  const refresh = useCallback(async () => {
    await new Promise<void>((resolve) => {
      timers.setTimeout(resolve, 1200);
    });
  }, [timers]);
  const ptr = usePullToRefresh(refresh);

  return (
    <Box
      sx={{
        height: 220,
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: 8,
      }}
    >
      <ScrollView
        sx={{ p: 3, gap: 2 }}
        refreshControl={
          ptr === null ? undefined : (
            <PullToRefreshControl
              refreshing={ptr.refreshing}
              onRefresh={ptr.onRefresh}
            />
          )
        }
      >
        <Text variant="body" label="Pull down to refresh" />
        {Array.from({ length: 12 }, (_, i) => (
          <Box key={i} sx={{ p: 3, background: 'surface', borderRadius: 6 }}>
            <Text variant="body" label={`Item ${i + 1}`} />
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
}

export default function PullToRefreshExample() {
  return (
    <ExampleRoot>
      <PullToRefreshDemo />
    </ExampleRoot>
  );
}
