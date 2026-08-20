import { DevicePortsProvider } from '@apps/client/device/device-ports-provider';
import { useClientEnv } from '@apps/client/product/client-env-provider';
import { KvProvider } from '@pkgs/kv/kv-provider';
import { AudioPlaybackProvider } from '@pkgs/sounds/audio-playback/audio-playback-context';
import { ComposeProviders, SpinnerProvider } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppFontsProvider } from './shell/fonts';
import { AppGestureHandler } from './shell/gesture-handler';
import { AppI18n } from './shell/i18n';
import { AppSafeArea } from './shell/safe-area';
import { AppSoundsProvider } from './shell/sounds';
import { AppSuspenseRoot } from './shell/suspense-root';
import { AppTheme } from './shell/theme';

/** Platform shell. Must sit under {@link ClientEnvProvider}. */
export function AppShellProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const env = useClientEnv();

  return (
    <DevicePortsProvider network={env.network} devMenu={env.devMenu}>
      <AudioPlaybackProvider port={env.audio}>
        <ComposeProviders
          providers={[
            AppGestureHandler,
            AppSafeArea,
            AppFontsProvider,
            ({ children: inner }: { children: ReactNode }) => (
              <KvProvider kv={env.kv}>{inner}</KvProvider>
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
