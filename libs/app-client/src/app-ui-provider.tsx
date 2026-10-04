/** @jsxImportSource solid-js */
/**
 * Command palette, sync/offline banners, and in-session chrome. Overlay /
 * surface-stack hosts live in `AppUiPortals` (outer shell) so `AppFrame`
 * menus work before SQLite. Banner *portal hosts* live on `AppFrame` (full
 * bleed outside the wide max-width column); this provider only mounts the
 * banner sources (`OfflineIndicator`, the outdated-app prompt, perf HUD, PWA
 * update).
 *
 * Mounts inside the identity-scoped sync tree (`sync-engine-ready-tree.tsx`),
 * after `AppLocalDatabaseProvider` (commands read the sync engine) and above
 * the sign-in modal (`AppSignInCapabilities` + `AuthModalsProvider`).
 *
 * The bottom sheet host is the `@pkgs/ui` web default (no provider needed).
 *
 * Deferred lib providers (each with its screen port): `EndSpaceModalProvider`
 * / `LeaveSpaceModalProvider` / space rooms / notifications — mounted from
 * `sync-engine-ready-tree.tsx` so mutation hubs stay off the shell entry.
 *
 * Embedded hosts (harness panels) omit an inner `KeyboardShortcutScope` so
 * the host column scope gates document shortcuts; standalone apps keep an
 * always-active scope.
 */

import { AppUpdateRequiredBanner } from './app-update-required';
import { OfflineIndicator } from './offline-indicator';
import { CommandPalette } from '@pkgs/ui-client/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-client/command-registry-context';
import { KeyboardShortcutScope } from '@pkgs/ui-client/keyboard-shortcut-scope';
import { type JSX, Show } from 'solid-js';
import { AppCommands } from './app-commands';
import { useEmbeddedApp } from './embedded-app-context';
import { PerfHudOverlay } from './perf-hud-overlay';
import { PwaUpdatePromptBanner } from './update-prompt';

function AppCommandRegistry(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const embedded = useEmbeddedApp();
  // Embedded: inherit the host column `KeyboardShortcutScope` (must create
  // the registry under that ancestor — do not pre-build JSX then wrap).
  // Standalone: always-active scope so nested hosts can still opt out.
  return (
    <Show
      when={embedded}
      fallback={
        <KeyboardShortcutScope active>
          <CommandRegistryProvider enableDefaultShortcuts>
            <AppCommands />
            <CommandPalette />
            {props.children}
            <PwaUpdatePromptBanner />
          </CommandRegistryProvider>
        </KeyboardShortcutScope>
      }
    >
      <CommandRegistryProvider enableDefaultShortcuts>
        <AppCommands />
        <CommandPalette />
        {props.children}
      </CommandRegistryProvider>
    </Show>
  );
}

export function AppUiProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <>
      <OfflineIndicator />
      <AppUpdateRequiredBanner />
      <PerfHudOverlay />
      <AppCommandRegistry>{props.children}</AppCommandRegistry>
    </>
  );
}
