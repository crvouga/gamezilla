import { useCallback } from 'react';
import { Box } from '../box';
import { useMutationButton } from '../button/use-mutation-button';
import { Stack } from '../stack';
import { Text } from '../text';
import { FloatingActionButton } from './floating-action-button';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function FloatingActionButtonExample() {
  const succeed = useMutationButton({
    operation: useCallback(() => delay(900), []),
    labels: {
      idle: 'Create',
      loading: 'Creating…',
      success: 'Created',
      error: "Couldn't create",
    },
  });
  const fail = useMutationButton({
    operation: useCallback(async () => {
      await delay(900);
      throw new Error('Network unreachable');
    }, []),
    labels: {
      idle: 'Create',
      loading: 'Creating…',
      success: 'Created',
      error: "Couldn't create",
    },
  });

  return (
    <Box sx={{ p: 4, gap: 4, minHeight: 200 }}>
      <Text variant="heading" label="FloatingActionButton" />
      <Stack direction="horizontal" spacing={4} align="center">
        <FloatingActionButton {...succeed.fabProps} />
        <FloatingActionButton {...fail.fabProps} />
      </Stack>
    </Box>
  );
}
