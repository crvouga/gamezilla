import { DevicePortsProvider } from '@apps/client/device/device-ports-provider';
import { KvProvider } from '@pkgs/kv/kv-provider';
import { AudioPlaybackProvider } from '@pkgs/sounds/audio-playback/audio-playback-context';
import { ComposeProviders, SpinnerProvider } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useClientSystemResources } from './client-system-resources';
import { AppFontsProvider } from './shell/fonts';
import { AppGestureHandler } from './shell/gesture-handler';
import { AppI18n } from './shell/i18n';
import { AppSafeArea } from './shell/safe-area';
import { AppSoundsProvider } from './shell/sounds';
import { AppSuspenseRoot } from './shell/suspense-root';
import { AppTheme } from './shell/theme';

/**
 * Platform shell with optional sim resources for Kv / device / audio ports.
 * Must sit under {@link SystemProvider}.
 */
export function AppShellProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { kv, network, devMenu, audio } = useClientSystemResources();

  return (
    <DevicePortsProvider
      {...(network !== undefined ? { network } : {})}
      {...(devMenu !== undefined ? { devMenu } : {})}
    >
      <AudioPlaybackProvider {...(audio !== undefined ? { port: audio } : {})}>
        <ComposeProviders
          providers={[
            AppGestureHandler,
            AppSafeArea,
            AppFontsProvider,
            ({ children: inner }: { children: ReactNode }) => (
              <KvProvider {...(kv !== undefined ? { kv } : {})}>
                {inner}
              </KvProvider>
            ),
            AppSoundsProvider,
            AppTheme,
            AppI18n,
            SpinnerProvider,
            AppSuspenseRoot,
          ]}
        >
          {children}
        </ComposeProviders>
      </AudioPlaybackProvider>
    </DevicePortsProvider>
  );
}
