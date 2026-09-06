/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

/**
 * Render under an English Lingui provider. Catalog is empty on purpose: with
 * `descriptorFields: 'all'` the macro keeps the source message, so components
 * render English without loading the compiled catalog.
 */
export function renderWithI18n(
  ui: () => JSX.Element
): ReturnType<typeof render> {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return render(() => <I18nProvider i18n={i18n}>{ui()}</I18nProvider>);
}
