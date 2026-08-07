import { KvProvider } from '@pkgs/kv/kv-provider';
import { ComposeProviders, SpinnerProvider } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { AppFontsProvider } from './shell/fonts';
import { AppGestureHandler } from './shell/gesture-handler';
import { AppI18n } from './shell/i18n';
import { AppSafeArea } from './shell/safe-area';
import { AppSoundsProvider } from './shell/sounds';
import { AppSuspenseRoot } from './shell/suspense-root';
import { AppTheme } from './shell/theme';

const shellProviders = [
  AppGestureHandler,
  AppSafeArea,
  AppFontsProvider,
  KvProvider,
  AppSoundsProvider,
  AppTheme,
  AppI18n,
  SpinnerProvider,
  AppSuspenseRoot,
];

/** Platform shell: gesture handler, safe area, fonts, kv, theme, i18n, suspense. */
export function AppShellProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={shellProviders}>{children}</ComposeProviders>
  );
}
