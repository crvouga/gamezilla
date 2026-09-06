import { useTimers } from '@pkgs/clock';
import { useEffect, useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { ProgressBar } from './progress-bar';

function DeterminateDemo() {
  const timers = useTimers();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = timers.setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : p + 0.05));
    }, 200);
    return () => timers.clearInterval(id);
  }, [timers]);

  return (
    <>
      <Text
        variant="label"
        label={`Determinate (${Math.round(progress * 100)}%)`}
      />
      <ProgressBar progress={progress} />
    </>
  );
}

export default function ProgressBarExample() {
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
