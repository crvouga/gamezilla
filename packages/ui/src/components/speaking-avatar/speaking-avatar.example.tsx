import { useEffect, useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { SpeakingAvatar } from './speaking-avatar';

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
  return <SpeakingAvatar message={ROTATING_LINES[index] ?? ''} />;
}

export default function SpeakingAvatarExample() {
  return (
    <Box sx={{ p: 4, gap: 6 }}>
      <Text variant="heading" label="SpeakingAvatar" />

      <Text variant="caption" label="Static message" />
      <SpeakingAvatar message="Hello! I'm your puzzle coach." />

      <Text variant="caption" label="Rotating message (re-types on change)" />
      <RotatingMessage />

      <Text variant="caption" label="Custom seed (different face)" />
      <SpeakingAvatar message="Different seed, different face." seed="bishop" />

      <Text variant="caption" label="Smaller avatar + faster typing" />
      <SpeakingAvatar
        message="Tighter layout for compact screens."
        avatarSize={40}
        charDelayMs={15}
      />
    </Box>
  );
}
