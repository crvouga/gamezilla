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
import type { JSX } from 'solid-js';

const IDP_I18N = setupI18n({ locale: 'en', messages: { en: {} } });

export function IdpUiRoot(props: { readonly children: JSX.Element }) {
  return (
    <I18nProvider i18n={IDP_I18N}>
      <ThemeProvider colorScheme="system">{props.children}</ThemeProvider>
    </I18nProvider>
  );
}
