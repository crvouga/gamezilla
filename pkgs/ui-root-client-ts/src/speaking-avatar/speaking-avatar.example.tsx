/** @jsxImportSource solid-js */
/**
 * Explorer preview. Audio is injected via `speaker`; the design-system
 * harness has no TTS backend, so every instance renders with `speak={false}`
 * (bubble + typing animation only, mute toggle hidden).
 */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { createSignal, type JSX, onCleanup } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const ROTATING_LINES = [
  'Your move.',
  'Nice — you found the fork.',
  'Wrong — try again.',
  'Solved! On to the next one.',
];

const ROTATE_INTERVAL_MS = 4500;

function RotatingMessage(): JSX.Element {
  const timers = useTimers();
  const [index, setIndex] = createSignal(0);
  const id = timers.setInterval(() => {
    setIndex((i) => (i + 1) % ROTATING_LINES.length);
  }, ROTATE_INTERVAL_MS);
  onCleanup(() => timers.clearInterval(id));
  return (
    <SpeakingAvatar message={ROTATING_LINES[index()] ?? ''} speak={false} />
  );
}

export default function SpeakingAvatarExample(): JSX.Element {
  return (
    <ExampleRoot gap="xl">
      <p class="text textCaption">{'Static message'}</p>
      <SpeakingAvatar message="Hello! I'm your puzzle coach." speak={false} />

      <p class="text textCaption">{'Rotating message (re-types on change)'}</p>
      <RotatingMessage />

      <p class="text textCaption">{'Custom seed (different face)'}</p>
      <SpeakingAvatar
        message="Different seed, different face."
        seed="bishop"
        speak={false}
      />

      <p class="text textCaption">{'Smaller avatar (compact layout)'}</p>
      <SpeakingAvatar
        message="Tighter layout for compact screens."
        avatarSize={40}
        speak={false}
      />
    </ExampleRoot>
  );
}
