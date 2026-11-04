import { i18n as globalI18n, setupI18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import {
  type AppRouter,
  StaticAppRouterProvider,
} from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { children, createEffect, type JSX, onCleanup } from 'solid-js';
import { addons } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { createJSXDecorator, type Preview } from 'storybook-solidjs-vite';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/application.css';
import { backgrounds, chromaticModes, viewports } from './preview-options';
import { trackStoryReadiness } from './story-readiness';

// Stories render source English from macro descriptors, without the product
// catalog. Production builds drop Lingui's runtime compiler, so supply it or
// `{name}` placeholders render verbatim. Product modules also translate
// through the global instance (`t` from `@lingui/core/macro`).
globalI18n.setMessagesCompiler(compileMessage);
globalI18n.loadAndActivate({ locale: 'en', messages: {} });

/** Navigation spies: screen stories record where a crumb or action would go. */
function createStoryRouter(): AppRouter {
  return {
    push: fn().mockName('router.push'),
    replace: fn().mockName('router.replace'),
    back: fn().mockName('router.back'),
    canGoBack: () => false,
  };
}

/**
 * Product screen views opt in with `parameters: { appRouter: true }`; other
 * stories stay router-free so a component that wrongly needs one still fails.
 * A screen renders where the app renders it: inside `AppFrame`, filling the
 * viewport, so wide layouts get the app's centered column and page inset.
 * The frame's own chrome (header, tab bar, account menu) opts out with
 * `appFrame: false`.
 */
function withOptionalRouter(
  parameters: Record<string, unknown>,
  story: () => JSX.Element
): JSX.Element {
  if (parameters['appRouter'] !== true) return story();
  return (
    <StaticAppRouterProvider router={createStoryRouter()}>
      {parameters['appFrame'] === false ? (
        story()
      ) : (
        <StoryAppViewport story={story} />
      )}
    </StaticAppRouterProvider>
  );
}

/**
 * The story mounts once and moves with the frame's compact / wide switch
 * (a second `<Story />` would render empty).
 */
function StoryAppViewport(props: { story: () => JSX.Element }): JSX.Element {
  const screen = children(() => props.story());
  return (
    <div class="box h-dvh min-h-0" data-component="StoryAppViewport">
      <AppFrame>{screen()}</AppFrame>
    </div>
  );
}

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
  i18n.setMessagesCompiler(compileMessage);
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme={context.globals['theme'] === 'dark' ? 'dark' : 'light'}
          reducedMotion
          transparent
        >
          <SurfaceStackProvider>
            {withOptionalRouter(context.parameters, () => (
              <Story />
            ))}
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
    chromatic: { modes: chromaticModes },
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
          'Screens',
          'Games',
          ['Shared', ['Screens', 'Components'], '*'],
        ],
      },
    },
    viewport: { options: viewports },
  },
} satisfies Preview;
