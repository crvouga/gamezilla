import { Text } from '@pkgs/ui';
import { I18nProvider, type TransRenderProps } from '@lingui/react';
import type { ReactNode } from 'react';
import { i18n } from './i18n';

function LinguiDefaultText(props: TransRenderProps): ReactNode {
  return <Text variant="body">{props.children}</Text>;
}

export function AppI18nProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <I18nProvider i18n={i18n} defaultComponent={LinguiDefaultText}>
      {children}
    </I18nProvider>
  );
}
