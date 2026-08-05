import { useState } from 'react';
import { Pressable } from '../pressable';
import { SegmentedControl } from '../segmented-control';
import { Stack } from '../stack';
import { Text } from '../text';
import { SoundIndicator, type SoundIndicatorState } from './sound-indicator';
import { ExampleRoot } from '../explorer/example-root';

const STATE_SEGMENTS: { key: SoundIndicatorState; label: string }[] = [
  { key: 'idle', label: 'Idle' },
  { key: 'playing', label: 'Playing' },
  { key: 'muted', label: 'Muted' },
];

export default function SoundIndicatorExample() {
  const [state, setState] = useState<SoundIndicatorState>('playing');
  const [tappedMuted, setTappedMuted] = useState(false);
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        label="All three states (theme-resolved colors)"
      />
      <Stack direction="horizontal" spacing={3} align="center">
        <SoundIndicator state="idle" />
        <SoundIndicator state="playing" />
        <SoundIndicator state="muted" />
      </Stack>

      <Text variant="caption" label="Sizes (playing)" />
      <Stack direction="horizontal" spacing={3} align="center">
        <SoundIndicator state="playing" size={12} />
        <SoundIndicator state="playing" size={16} />
        <SoundIndicator state="playing" size={24} />
        <SoundIndicator state="playing" size={32} />
      </Stack>

      <Text variant="caption" label="Always-light callout (color overrides)" />
      <Stack direction="horizontal" spacing={3} align="center">
        <SoundIndicator
          state="idle"
          backgroundColor="#ffffff"
          color="#111111"
          mutedColor="#888888"
        />
        <SoundIndicator
          state="playing"
          backgroundColor="#ffffff"
          color="#111111"
          mutedColor="#888888"
        />
        <SoundIndicator
          state="muted"
          backgroundColor="#ffffff"
          color="#111111"
          mutedColor="#888888"
        />
      </Stack>

      <Text variant="caption" label="Live state switcher" />
      <SegmentedControl
        segments={STATE_SEGMENTS}
        selected={state}
        onSelect={setState}
      />
      <Stack direction="horizontal" spacing={3} align="center">
        <SoundIndicator state={state} size={20} />
        <Text variant="body" label={`state="${state}"`} />
      </Stack>

      <Text variant="caption" label="Tap to toggle mute" />
      <Pressable
        onPress={() => {
          setTappedMuted((m) => !m);
        }}
        accessibilityRole="button"
        accessibilityLabel={tappedMuted ? 'Unmute' : 'Mute'}
      >
        <SoundIndicator state={tappedMuted ? 'muted' : 'playing'} size={20} />
      </Pressable>
    </ExampleRoot>
  );
}
