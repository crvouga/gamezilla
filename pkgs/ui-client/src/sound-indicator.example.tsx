/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { SegmentedControl } from './segmented-control';
import { SoundIndicator } from './sound-indicator';
import type { SoundIndicatorState } from './sound-indicator';

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
      <p class="text textCaption">
        {'All three states (theme-resolved colors)'}
      </p>
      <div class="box flex-row gap-3 items-center">
        <SoundIndicator state="idle" />
        <SoundIndicator state="playing" />
        <SoundIndicator state="muted" />
      </div>

      <p class="text textCaption">{'Sizes (playing)'}</p>
      <div class="box flex-row gap-3 items-center">
        <SoundIndicator state="playing" size={12} />
        <SoundIndicator state="playing" size={16} />
        <SoundIndicator state="playing" size={24} />
        <SoundIndicator state="playing" size={32} />
      </div>

      <p class="text textCaption">{'Always-light callout (color overrides)'}</p>
      <div class="box flex-row gap-3 items-center">
        <SoundIndicator state="idle" {...LIGHT_OVERRIDES} />
        <SoundIndicator state="playing" {...LIGHT_OVERRIDES} />
        <SoundIndicator state="muted" {...LIGHT_OVERRIDES} />
      </div>
    </>
  );
}

export default function SoundIndicatorExample(): JSX.Element {
  const [state, setState] = createSignal<SoundIndicatorState>('playing');
  const [tappedMuted, setTappedMuted] = createSignal(false);
  return (
    <ExampleRoot>
      <StaticRows />

      <p class="text textCaption">{'Live state switcher'}</p>
      <SegmentedControl<SoundIndicatorState>
        segments={STATE_SEGMENTS}
        selected={state()}
        onSelect={setState}
      />
      <div class="box flex-row gap-3 items-center">
        <SoundIndicator state={state()} size={20} />
        <p class="text">{`state="${state()}"`}</p>
      </div>

      <p class="text textCaption">{'Click to toggle mute'}</p>
      <button
        class="clickable clickableTint self-start min-w-11 min-h-11"
        type="button"
        onClick={() => setTappedMuted((m) => !m)}
        aria-label={tappedMuted() ? 'Unmute' : 'Mute'}
      >
        <SoundIndicator state={tappedMuted() ? 'muted' : 'playing'} size={20} />
      </button>
    </ExampleRoot>
  );
}
