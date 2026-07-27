import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { ObjectStoreProvider } from '@pkgs/object-store/react-context';
import { TtsProvider } from '@pkgs/tts/client/tts-context';
import { Voices } from '@pkgs/tts/shared/tts-voice';
import { useEffect, useMemo, useState } from 'react';
import { Text } from '../text';
import { SpeakingAvatar } from './speaking-avatar';
import { ExampleRoot } from '../explorer/example-root';

const ROTATING_LINES = [
  'Your move.',
  'Nice — you found the fork.',
  'Wrong — try again.',
  'Solved! On to the next one.',
];

const ROTATE_INTERVAL_MS = 4500;

function RotatingMessage() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_LINES.length);
    }, ROTATE_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);
  return (
    <SpeakingAvatar
      message={ROTATING_LINES[index] ?? ''}
      voice={Voices.David}
      speak={false}
    />
  );
}

export default function SpeakingAvatarExample() {
  // Storybook preview: mount an in-memory `<ObjectStoreProvider>` (the TTS
  // client now requires a cache) and a `<TtsProvider>` so the avatar's
  // `useTts()` resolves. Audio is muted via `speak={false}` because the
  // placeholder `apiUrl` is unreachable from the design-system harness.
  const objectStore = useMemo(() => new ObjectStoreImplInMemory(), []);
  return (
    <ObjectStoreProvider value={objectStore}>
      <TtsProvider apiUrl="http://localhost">
        <ExampleRoot sx={{ gap: 6 }}>
          <Text variant="heading" label="SpeakingAvatar" />

          <Text variant="caption" label="Static message" />
          <SpeakingAvatar
            message="Hello! I'm your puzzle coach."
            voice={Voices.David}
            speak={false}
          />

          <Text
            variant="caption"
            label="Rotating message (re-types on change)"
          />
          <RotatingMessage />

          <Text variant="caption" label="Custom seed (different face)" />
          <SpeakingAvatar
            message="Different seed, different face."
            voice={Voices.Sam}
            seed="bishop"
            speak={false}
          />

          <Text variant="caption" label="Smaller avatar (compact layout)" />
          <SpeakingAvatar
            message="Tighter layout for compact screens."
            voice={Voices.Olivia}
            avatarSize={40}
            speak={false}
          />
        </ExampleRoot>
      </TtsProvider>
    </ObjectStoreProvider>
  );
}
