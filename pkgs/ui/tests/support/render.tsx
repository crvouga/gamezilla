/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { createSimClock } from '@pkgs/clock/sim-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { ThemeProvider } from '@pkgs/ui';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

type RenderOptions = {
  colorScheme?: 'light' | 'dark';
  width?: number;
  height?: number;
};

/**
 * Mounts `ui` under Lingui `I18nProvider` (en, source strings) + `ThemeProvider` + sim `ClockProvider` (virtual timers,
 * so nothing in the design system touches wall time in tests).
 */
export function renderUi(ui: () => JSX.Element, options: RenderOptions = {}) {
  const sim = createSimClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const result = render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={sim.clock} timers={sim.timers}>
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
  return { ...result, clock: sim.clock, timers: sim.timers };
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
