/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock/solid';
import type { JSX } from 'solid-js';
import { useMutationButton } from '../button/use-mutation-button';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { FloatingActionButton } from './floating-action-button';

const DEMO_MS = 900;

const LABELS = {
  idle: 'Create',
  loading: 'Creating…',
  success: 'Created',
  error: "Couldn't create",
};

function FabDemo(): JSX.Element {
  const timers = useTimers();
  const delay = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
  const succeed = useMutationButton({
    operation: () => delay(DEMO_MS),
    labels: LABELS,
  });
  const fail = useMutationButton({
    operation: async () => {
      await delay(DEMO_MS);
      throw new Error('Network unreachable');
    },
    labels: LABELS,
  });

  return (
    <Stack direction="horizontal" spacing={4} align="center">
      <FloatingActionButton {...succeed.fabProps} />
      <FloatingActionButton {...fail.fabProps} />
    </Stack>
  );
}

export default function FloatingActionButtonExample(): JSX.Element {
  return (
    <ExampleRoot sx={{ minHeight: 200 }}>
      <FabDemo />
    </ExampleRoot>
  );
}
