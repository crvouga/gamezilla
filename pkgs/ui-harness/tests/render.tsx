/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ThemeProvider } from '@pkgs/ui-client/theme-context';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

type RenderOptions = {
  colorScheme?: 'light' | 'dark';
  width?: number;
  height?: number;
};

/**
 * Mounts `ui` under Lingui `I18nProvider` (en, source strings) + `ThemeProvider` + harness `ClockProvider` (virtual timers,
 * so nothing in the design system touches wall time in tests).
 */
export function renderUi(ui: () => JSX.Element, options: RenderOptions = {}) {
  const harness = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const result = render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme={options.colorScheme ?? 'light'}
          fixedLayout={{
            width: options.width ?? 1024,
            height: options.height ?? 768,
          }}
        >
          {ui()}
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
  return { ...result, clock: harness.clock, timers: harness.timers };
}

/** Inline style attribute with whitespace removed, e.g. `padding:8px;`. */
export function cssOf(el: Element): string {
  return (el.getAttribute('style') ?? '').replace(/\s+/g, '');
}

/** `document.querySelector` that throws instead of returning `null`. */
export function mustQuery(selector: string): Element {
  const el = document.querySelector(selector);
  if (el === null) throw new Error(`No element matches ${selector}`);
  return el;
}
