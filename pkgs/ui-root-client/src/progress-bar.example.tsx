/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client/solid';
import { createSignal, type JSX, onCleanup } from 'solid-js';
import { ExampleRoot } from './example-root';
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
    <ProgressBar
      label="Uploading file"
      progress={progress()}
      description="Keep this screen open until the upload finishes."
    />
  );
}

export default function ProgressBarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-col gap-6">
        <DeterminateDemo />
        <ProgressBar
          label="Preparing file"
          description="The amount of work is not known yet."
        />
        <ProgressBar label="Upload complete" progress={1} tone="success" />
        <ProgressBar label="Upload failed" progress={0.6} tone="destructive" />
        <ProgressBar progress={0.3} size="sm" />
        <ProgressBar size="sm" />
      </div>
    </ExampleRoot>
  );
}
