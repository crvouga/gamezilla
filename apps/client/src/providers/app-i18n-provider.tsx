import { AppI18nProvider } from '@gamezilla/client/i18n/i18n-provider';
import type { ReactNode } from 'react';

export function AppI18nProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <AppI18nProvider>{children}</AppI18nProvider>;
}
