/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock/solid';
import { createSignal, type JSX, onCleanup } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { ProgressBar } from './progress-bar';

const TICK_MS = 200;
const STEP = 0.05;

function DeterminateDemo(): JSX.Element {
  const timers = useTimers();
  const [progress, setProgress] = createSignal(0);

  const id = timers.setInterval(() => {
    setProgress((p) => (p >= 1 ? 0 : p + STEP));
  }, TICK_MS);
  onCleanup(() => timers.clearInterval(id));

  return (
    <>
      <Text
        variant="label"
        label={`Determinate (${Math.round(progress() * 100)}%)`}
      />
      <ProgressBar progress={progress()} />
    </>
  );
}

export default function ProgressBarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Stack spacing={3}>
        <DeterminateDemo />

        <Text variant="label" label="Indeterminate" />
        <ProgressBar indeterminate />

        <Text variant="label" label="Custom color & height" />
        <ProgressBar progress={0.7} color="success" height={8} />
        <ProgressBar progress={0.3} color="warning" height={8} />
        <ProgressBar progress={0.9} color="destructive" height={8} />
      </Stack>
    </ExampleRoot>
  );
}
