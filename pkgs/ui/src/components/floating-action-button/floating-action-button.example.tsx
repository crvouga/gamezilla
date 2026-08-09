import { useTimers } from '@pkgs/clock';
import { useCallback } from 'react';
import { useMutationButton } from '../button/use-mutation-button';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { FloatingActionButton } from './floating-action-button';

function FabDemo() {
  const timers = useTimers();
  const delay = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timers.setTimeout(resolve, ms);
      }),
    [timers]
  );
  const succeed = useMutationButton({
    operation: useCallback(() => delay(900), [delay]),
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
    }, [delay]),
    labels: {
      idle: 'Create',
      loading: 'Creating…',
      success: 'Created',
      error: "Couldn't create",
    },
  });

  return (
    <Stack direction="horizontal" spacing={4} align="center">
      <FloatingActionButton {...succeed.fabProps} />
      <FloatingActionButton {...fail.fabProps} />
    </Stack>
  );
}

export default function FloatingActionButtonExample() {
  return (
    <ExampleRoot sx={{ minHeight: 200 }}>
      <FabDemo />
    </ExampleRoot>
  );
}
