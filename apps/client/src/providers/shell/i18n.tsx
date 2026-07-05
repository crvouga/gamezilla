import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import type { ReactNode } from 'react';

export function AppI18n({ children }: { children: ReactNode }): ReactNode {
  return <AppI18nProvider>{children}</AppI18nProvider>;
}
