import { ComposeProviders, SpinnerProvider } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppGestureHandler } from './shell/gesture-handler';
import { AppFontsProvider } from './shell/fonts';
import { AppI18n } from './shell/i18n';
import { AppSafeArea } from './shell/safe-area';
import { AppSuspenseRoot } from './shell/suspense-root';
import { AppTheme } from './shell/theme';

const shellProviders = [
  AppGestureHandler,
  AppSafeArea,
  AppFontsProvider,
  AppTheme,
  AppI18n,
  SpinnerProvider,
  AppSuspenseRoot,
];

/** Platform shell: gesture handler, safe area, fonts, theme, i18n, suspense. */
export function AppShellProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={shellProviders}>{children}</ComposeProviders>
  );
}
