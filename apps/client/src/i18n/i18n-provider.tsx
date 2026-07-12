import { I18nProvider, type TransRenderProps } from '@lingui/react';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import { i18n } from './i18n';

/**
 * Unstyled host so `<Trans>` inherits ambient Text styles (TopBar titles,
 * EmptyState, etc.). A styled `@pkgs/ui` `variant="body"` wrapper previously
 * reset fontWeight inside parents like `navigationTitle`.
 */
function LinguiDefaultText(props: TransRenderProps): ReactNode {
  return <RNText>{props.children}</RNText>;
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
