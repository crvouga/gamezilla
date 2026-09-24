/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

export type RenderResult = ReturnType<typeof render>;

/** Render under an English `I18nProvider` so Lingui macros resolve. */
export function renderWithI18n(ui: () => JSX.Element): RenderResult {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return render(() => <I18nProvider i18n={i18n}>{ui()}</I18nProvider>);
}
