import { i18n as globalI18n, setupI18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import {
  type AppRouter,
  StaticAppRouterProvider,
} from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { JSX } from '@solidjs/web';
import { createEffect, onCleanup, Show } from 'solid-js';
import { addons } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { createJSXDecorator, type Preview } from 'storybook-solidjs-vite';
import { applyDecorators as applySolidDecorators } from 'storybook-solidjs-vite/renderer/solid-next';
import '@pkgs/ui-root-client-ts/fonts';
import '@pkgs/ui-root-client-ts/application.css';
import { backgrounds, viewports } from './preview-options';
import { loadStoryFonts } from './story-fonts';
import { storyReducedMotion } from './story-motion';
import { trackStoryReadiness } from './story-readiness';
import { untrackedStory } from './untracked-story';

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

/** Screen fixtures use the same navigation and space views as production. */
function withOptionalRouter(
  parameters: Record<string, unknown>,
  id: string,
  story: () => JSX.Element
): JSX.Element {
  if (parameters['appRouter'] !== true) return story();
  const Shell = parameters['productShell'] as
    | ((props: {
        story: () => JSX.Element;
        asRail: boolean;
        id: string;
        route: unknown;
      }) => JSX.Element)
    | undefined;
  if (!Shell) throw new Error('Product shell preview annotation is missing');
  return (
    <StaticAppRouterProvider router={createStoryRouter()}>
      <Show when={parameters['appFrame'] !== false} fallback={story()}>
        <div class="box h-dvh min-h-0" data-component="StoryAppViewport">
          <Shell
            story={story}
            asRail={parameters['appFrame'] === 'rail'}
            id={id}
            route={parameters['storyRoute']}
          />
        </div>
      </Show>
    </StaticAppRouterProvider>
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
  createEffect(
    () => Number(context.globals['timeStep'] ?? 0),
    (ms) => {
      if (Number.isFinite(ms) && ms > 0) harness.clock.advance(ms);
    }
  );
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  i18n.setMessagesCompiler(compileMessage);
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme={context.globals['theme'] === 'dark' ? 'dark' : 'light'}
          reducedMotion={storyReducedMotion(context.globals)}
          transparent
        >
          <SurfaceStackProvider>
            {withOptionalRouter(context.parameters, context.id, () => (
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
  applyDecorators: (story, decorators) =>
    untrackedStory(applySolidDecorators(story, decorators)),
  loaders: [
    async () => {
      await loadStoryFonts(document.fonts);
      return {};
    },
  ],
  initialGlobals: {
    theme: 'light',
    spaceGame: 'light-cycles',
    spaceRole: 'guest',
    motion: 'reduced',
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
    motion: {
      description: 'Reduced for stable screenshots; system follows the browser',
      toolbar: { icon: 'play', items: ['reduced', 'system'] },
    },
    theme: {
      description: 'Production color scheme',
      toolbar: { icon: 'circlehollow', items: ['light', 'dark'] },
    },
    // Space screen stories read these; every other story ignores them.
    spaceGame: {
      description: 'Game shown by the Space screen stories',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'light-cycles', title: 'Light Cycles' },
          { value: 'chess', title: 'Chess' },
          { value: 'hearts', title: 'Hearts' },
          { value: 'battleship', title: 'Battleship' },
          { value: 'word-tiles', title: 'Word Tiles' },
        ],
      },
    },
    spaceRole: {
      description: 'Who is looking at the Space screen stories',
      toolbar: {
        icon: 'user',
        items: [
          { value: 'host', title: 'Host' },
          { value: 'guest', title: 'Guest' },
        ],
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    controls: { expanded: true, sort: 'requiredFirst' },
    backgrounds,
    options: {
      storySort: {
        // Inside a level, folders and components read A-Z.
        method: 'alphabetical',
        locales: 'en-US',
        order: [
          'Start here',
          'Screens',
          // Everything seen inside a space leads its level.
          ['Space'],
          'Templates',
          'Organisms',
          'Molecules',
          'Atoms',
          'Foundations',
        ],
      },
    },
    viewport: { options: viewports },
  },
} satisfies Preview;
