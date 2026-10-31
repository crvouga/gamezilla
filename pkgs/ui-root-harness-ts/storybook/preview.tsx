import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createEffect, onCleanup } from 'solid-js';
import { addons } from 'storybook/preview-api';
import { createJSXDecorator, type Preview } from 'storybook-solidjs-vite';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/application.css';
import { backgrounds, viewports } from './preview-options';
import { trackStoryReadiness } from './story-readiness';

const withProviders = createJSXDecorator((Story, context) => {
  if (context.viewMode === 'story') {
    onCleanup(
      trackStoryReadiness(
        context.canvasElement,
        context.id,
        addons.getChannel()
      )
    );
  }
  const harness = createHarnessClock({ startMs: 1_700_000_000_000 });
  const advance = (event: Event): void => {
    const ms: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0)
      harness.clock.advance(ms);
  };
  context.canvasElement.addEventListener('advance-story-time', advance);
  onCleanup(() =>
    context.canvasElement.removeEventListener('advance-story-time', advance)
  );
  createEffect(() => {
    const ms = Number(context.globals['timeStep'] ?? 0);
    if (Number.isFinite(ms) && ms > 0) harness.clock.advance(ms);
  });
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme={context.globals['theme'] === 'dark' ? 'dark' : 'light'}
          reducedMotion
          transparent
        >
          <SurfaceStackProvider>
            <Story />
          </SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  );
});

export default {
  decorators: [withProviders],
  initialGlobals: {
    theme: 'light',
    timeStep: '0',
    backgrounds: { value: 'canvas', grid: false },
    a11y: { manual: true },
    measureEnabled: false,
    outline: false,
  },
  globalTypes: {
    timeStep: {
      description: 'Advance virtual time without wall timers',
      toolbar: {
        icon: 'timer',
        items: [
          { value: '0', title: 'Paused' },
          { value: '1000', title: 'Advance 1 second' },
          { value: '5000', title: 'Advance 5 seconds' },
        ],
      },
    },
    theme: {
      description: 'Production color scheme',
      toolbar: { icon: 'circlehollow', items: ['light', 'dark'] },
    },
  },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    controls: { expanded: true, sort: 'requiredFirst' },
    backgrounds,
    options: {
      storySort: {
        order: [
          'Start here',
          'Foundations',
          'Atoms',
          'Molecules',
          'Organisms',
          'Templates',
          'Games',
          ['Shared', ['Screens', 'Components'], '*'],
        ],
      },
    },
    viewport: { options: viewports },
  },
} satisfies Preview;
