import { useCallback } from 'react';
import { useMutationButton } from '../button/use-mutation-button';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
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
    <ExampleRoot sx={{ minHeight: 200 }}>
      <Stack direction="horizontal" spacing={4} align="center">
        <FloatingActionButton {...succeed.fabProps} />
        <FloatingActionButton {...fail.fabProps} />
      </Stack>
    </ExampleRoot>
  );
}
