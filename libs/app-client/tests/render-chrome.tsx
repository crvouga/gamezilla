/** @jsxImportSource solid-js */
/** Mount a piece of the shell chrome under the theme and a virtual clock. */

import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-client/theme-context';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

const COMPACT = { width: 390, height: 844 };

export function renderChrome(ui: () => JSX.Element): void {
  const harness = createHarnessClock();
  render(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={COMPACT}>
        <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}
