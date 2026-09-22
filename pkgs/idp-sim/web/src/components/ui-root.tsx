/**
 * The design-system providers every screen renders under.
 *
 * `@pkgs/ui` reads its theme from `ThemeProvider` and its built-in copy
 * ("Loading…" on a busy button) from Lingui, so the one tree the server
 * serializes and the browser mounts carries both. The screens' own copy is
 * English and stays literal; the catalog is empty on purpose, so Lingui
 * renders the design system's source strings.
 */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ThemeProvider } from '@pkgs/ui/theme/theme-context';
import { createContext, type JSX, useContext } from 'solid-js';

import type { IdpProviderKind } from '../../../src/shared/types';

const IDP_I18N = setupI18n({ locale: 'en', messages: { en: {} } });

const ProviderContext = createContext<IdpProviderKind>('google');

/** Which provider's flavor the screens are rendering for. */
export function useIdpProvider(): IdpProviderKind {
  return useContext(ProviderContext);
}

export function IdpUiRoot(props: {
  readonly provider: IdpProviderKind;
  readonly children: JSX.Element;
}) {
  return (
    <I18nProvider i18n={IDP_I18N}>
      <ProviderContext.Provider value={props.provider}>
        <ThemeProvider colorScheme="system">{props.children}</ThemeProvider>
      </ProviderContext.Provider>
    </I18nProvider>
  );
}
