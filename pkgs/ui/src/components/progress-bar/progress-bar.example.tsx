import { useState, useEffect } from 'react';
import { Text } from '../text';
import { Stack } from '../stack';
import { ProgressBar } from './progress-bar';
import { ExampleRoot } from '../explorer/example-root';

export default function ProgressBarExample() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : p + 0.05));
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <ExampleRoot>
      <Text variant="heading" label="ProgressBar" />

      <Stack spacing={3}>
        <Text
          variant="label"
          label={`Determinate (${Math.round(progress * 100)}%)`}
        />
        <ProgressBar progress={progress} />

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
