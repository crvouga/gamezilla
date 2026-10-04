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
    <>
      <label class="text textLabel">{`Determinate (${Math.round(progress() * 100)}%)`}</label>
      <ProgressBar progress={progress()} />
    </>
  );
}

export default function ProgressBarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-col gap-3">
        <DeterminateDemo />

        <label class="text textLabel">{'Indeterminate'}</label>
        <ProgressBar indeterminate />

        <label class="text textLabel">{'Custom color & height'}</label>
        <ProgressBar progress={0.7} color="success" height={8} />
        <ProgressBar progress={0.3} color="warning" height={8} />
        <ProgressBar progress={0.9} color="destructive" height={8} />
      </div>
    </ExampleRoot>
  );
}
