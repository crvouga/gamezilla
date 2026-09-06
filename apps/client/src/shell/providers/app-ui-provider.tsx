/** @jsxImportSource solid-js */
/**
 * Overlays, surfaces, banners, command palette. Must render after
 * `AppLocalDatabaseProvider` (commands read the sync engine).
 *
 * `OverlayPortalProvider` wraps `SurfaceStackProvider`: surface chrome renders
 * in the stack host (sibling of `children`), so overlay context must be
 * outside for modal tooltips to work. The bottom sheet host is the `@pkgs/ui`
 * web default (no provider needed).
 *
 * Deferred lib providers (each with its screen port): `EndSpaceModalProvider`
 * / `LeaveSpaceModalProvider` / `ReconcileEndedOpenSessions` (Spaces),
 * `AppSignInCapabilities` + `AuthModalsProvider` (sign-in modal).
 */

import {
  CommandPalette,
  CommandRegistryProvider,
  DismissibleBannerPortalProvider,
  KeyboardShortcutScope,
  OverlayPortalProvider,
  SurfaceStackProvider,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { AppCommands } from '../commands/app-commands';
import { useEmbeddedApp } from '../embedded-app-context';
import { PwaUpdatePromptBanner } from '../pwa/update-prompt';

function AppCommandRegistry(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const embedded = useEmbeddedApp();
  return (
    <KeyboardShortcutScope active={!embedded}>
      <CommandRegistryProvider enableDefaultShortcuts={!embedded}>
        <AppCommands />
        <CommandPalette />
        {props.children}
        <Show when={!embedded}>
          <PwaUpdatePromptBanner />
        </Show>
      </CommandRegistryProvider>
    </KeyboardShortcutScope>
  );
}

export function AppUiProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        <DismissibleBannerPortalProvider>
          <AppCommandRegistry>{props.children}</AppCommandRegistry>
        </DismissibleBannerPortalProvider>
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}
