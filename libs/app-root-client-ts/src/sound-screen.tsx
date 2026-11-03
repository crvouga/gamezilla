/** @jsxImportSource solid-js */
/** `/more/sound` — in-app sound effects mute toggle (`@pkgs/sounds/solid`). */

import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import type { JSX } from 'solid-js';
import { SoundSettingsScreenView } from './sound-screen-view';

/** `/more/sound`: wires `SoundSettingsScreenView` to the sounds preference. */
export function SoundSettingsScreen(): JSX.Element {
  const { muted, setMuted } = useSoundsPreference();
  return <SoundSettingsScreenView muted={muted()} onMutedChange={setMuted} />;
}
