import { STORY_SIGNED_IN_IDENTITY } from '@libs/app-root-client-ts/account-face-story.example';
import { AppHeaderGlobalMenuView } from '@libs/app-root-client-ts/app-header-global-menu-view';
import { AppHeaderIslandView } from '@libs/app-root-client-ts/app-header-island-view';
import { AppTabBarView } from '@libs/app-root-client-ts/app-tab-bar-view';
import { STORY_APP_TABS } from '@libs/app-root-client-ts/app-tabs-story.example';
import { StorySpaceFrame } from '@libs/spaces-client-ts/space-screen-chrome-story.example';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch, untrack } from 'solid-js';
import { fn } from 'storybook/test';
import { type StoryRoute, storyRoute } from './storybook-route';

function AccountMenu(props: { readonly showName?: boolean }): JSX.Element {
  return (
    <AppHeaderGlobalMenuView
      identity={STORY_SIGNED_IN_IDENTITY}
      connectivity="online"
      muted={false}
      showName={props.showName}
      onNavigate={fn()}
    />
  );
}

function RouteBody(props: {
  readonly route: StoryRoute;
  readonly children: JSX.Element;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Switch
      fallback={
        <StackVertical grow>
          <StackVertical grow>{props.children}</StackVertical>
          <Show when={props.route.tab && mode() === 'compact'}>
            <AppTabBarView
              tabs={STORY_APP_TABS}
              pathname={props.route.pathname}
              onSelect={fn()}
            />
          </Show>
        </StackVertical>
      }
    >
      <Match when={props.route.spaceBody === 'shell'}>
        <StorySpaceFrame title={props.route.spaceTitle}>
          {props.children}
        </StorySpaceFrame>
      </Match>
      {/* Already under its own frame, with the shell it claimed: bare. */}
      <Match when={props.route.spaceBody === 'story'}>{props.children}</Match>
    </Switch>
  );
}

function StoryFrame(props: {
  readonly story: () => JSX.Element;
  readonly asRail: boolean;
  readonly route: StoryRoute;
  readonly admin: boolean;
}): JSX.Element {
  // Storybook supplies the screen during mount. Both shells can replace
  // their compact layout after the theme measures the desktop viewport.
  const screen = untrack(() => props.story());
  if (untrack(() => props.admin)) return <AppFrame>{screen}</AppFrame>;
  return (
    <Show
      when={props.asRail}
      fallback={
        <AppFrame
          rail={
            <AppHeaderIslandView
              tabs={STORY_APP_TABS}
              pathname={props.route.pathname}
              onSelect={fn()}
              orientation="vertical"
              trailing={<AccountMenu showName />}
            />
          }
        >
          <RouteBody route={props.route}>{screen}</RouteBody>
        </AppFrame>
      }
    >
      <AppFrame rail={screen}>{null}</AppFrame>
    </Show>
  );
}

/** Injected into the framework preview by the product's preview annotation. */
export function StoryProductShell(props: {
  readonly story: () => JSX.Element;
  readonly asRail: boolean;
  readonly id: string;
  readonly route?: StoryRoute;
}): JSX.Element {
  const admin = untrack(
    () =>
      props.id.startsWith('screens-admin-') ||
      props.id.startsWith('screens-puzzles-import')
  );
  return (
    <AppFrameChromeProvider
      globalTrailing={admin ? undefined : <AccountMenu />}
    >
      <StoryFrame
        admin={admin}
        story={props.story}
        asRail={props.asRail}
        route={storyRoute(props.id, props.route)}
      />
    </AppFrameChromeProvider>
  );
}
