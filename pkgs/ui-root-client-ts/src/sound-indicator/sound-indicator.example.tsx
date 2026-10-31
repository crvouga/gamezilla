/** @jsxImportSource solid-js */

import { SoundIndicator } from '@pkgs/ui-root-client-ts/sound-indicator';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const TINT_OVERRIDES = {
  backgroundColor: 'tintSubtle',
  color: 'tint',
  mutedColor: 'textSecondary',
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

      <p class="text textCaption">{'Color overrides (token names)'}</p>
      <div class="box flex-row gap-3 items-center">
        <SoundIndicator state="idle" {...TINT_OVERRIDES} />
        <SoundIndicator state="playing" {...TINT_OVERRIDES} />
        <SoundIndicator state="muted" {...TINT_OVERRIDES} />
      </div>
    </>
  );
}

export default function SoundIndicatorExample(): JSX.Element {
  const [tappedMuted, setTappedMuted] = createSignal(false);
  return (
    <ExampleRoot>
      <StaticRows />

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
