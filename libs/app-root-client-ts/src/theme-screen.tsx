/** @jsxImportSource solid-js */
/**
 * `/more/theme` — light / dark / system appearance picker persisted through
 * `ThemePreferenceProvider` (kv-backed).
 */

import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { JSX } from 'solid-js';
import { ThemeSettingsScreenView } from './theme-screen-view';

/** `/more/theme`: wires `ThemeSettingsScreenView` to the theme preference. */
export function ThemeSettingsScreen(): JSX.Element {
  const { preference, setPreference } = useThemePreference();
  return (
    <ThemeSettingsScreenView
      preference={preference()}
      onSelect={setPreference}
    />
  );
}
