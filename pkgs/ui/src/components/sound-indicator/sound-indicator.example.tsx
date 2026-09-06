/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Clickable } from '../clickable';
import { ExampleRoot } from '../explorer/example-root';
import { SegmentedControl } from '../segmented-control';
import { Stack } from '../stack';
import { Text } from '../text';
import { SoundIndicator, type SoundIndicatorState } from './sound-indicator';

const STATE_SEGMENTS: readonly {
  key: SoundIndicatorState;
  label: string;
}[] = [
  { key: 'idle', label: 'Idle' },
  { key: 'playing', label: 'Playing' },
  { key: 'muted', label: 'Muted' },
];

const LIGHT_OVERRIDES = {
  backgroundColor: '#ffffff',
  color: '#111111',
  mutedColor: '#888888',
};

function StaticRows(): JSX.Element {
  return (
    <>
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
        <SoundIndicator state="idle" {...LIGHT_OVERRIDES} />
        <SoundIndicator state="playing" {...LIGHT_OVERRIDES} />
        <SoundIndicator state="muted" {...LIGHT_OVERRIDES} />
      </Stack>
    </>
  );
}

export default function SoundIndicatorExample(): JSX.Element {
  const [state, setState] = createSignal<SoundIndicatorState>('playing');
  const [tappedMuted, setTappedMuted] = createSignal(false);
  return (
    <ExampleRoot>
      <StaticRows />

      <Text variant="caption" label="Live state switcher" />
      <SegmentedControl<SoundIndicatorState>
        segments={STATE_SEGMENTS}
        selected={state()}
        onSelect={setState}
      />
      <Stack direction="horizontal" spacing={3} align="center">
        <SoundIndicator state={state()} size={20} />
        <Text variant="body" label={`state="${state()}"`} />
      </Stack>

      <Text variant="caption" label="Click to toggle mute" />
      <Clickable
        onClick={() => setTappedMuted((m) => !m)}
        aria-label={tappedMuted() ? 'Unmute' : 'Mute'}
        sx={{ alignSelf: 'flex-start', minWidth: 44, minHeight: 44 }}
      >
        <SoundIndicator state={tappedMuted() ? 'muted' : 'playing'} size={20} />
      </Clickable>
    </ExampleRoot>
  );
}
