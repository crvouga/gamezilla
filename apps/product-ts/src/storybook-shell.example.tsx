import { STORY_SIGNED_IN_IDENTITY } from '@libs/app-root-client-ts/account-face-story.example';
import { AppHeaderGlobalMenuView } from '@libs/app-root-client-ts/app-header-global-menu-view';
import { AppHeaderIslandView } from '@libs/app-root-client-ts/app-header-island-view';
import { AppTabBarView } from '@libs/app-root-client-ts/app-tab-bar-view';
import { STORY_APP_TABS } from '@libs/app-root-client-ts/app-tabs-story.example';
import { SpaceDetailScreenView } from '@libs/spaces-client-ts/space-detail-screen-view';
import { AppFrame } from '@pkgs/ui-root-client-ts/app-frame';
import { AppFrameChromeProvider } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { children, type JSX, Show } from 'solid-js';
import { fn } from 'storybook/test';
import { type StoryRoute, storyRoute } from './storybook-route';

function AccountMenu(props: { readonly showName?: boolean }): JSX.Element {
  return (
    <AppHeaderGlobalMenuView
      identity={STORY_SIGNED_IN_IDENTITY}
      connectivity="online"
      theme="system"
      muted={false}
      showName={props.showName}
      onNavigate={fn()}
    />
  );
}

function SpaceBody(props: { readonly children: JSX.Element }): JSX.Element {
  return (
    <SpaceDetailScreenView
      title="Friday game night"
      spaceId="story-room"
      status="ready"
      hostOffline={false}
      canRename
      canEnd
      presenceCount={2}
      onPressHome={fn()}
      onPressBack={null}
      onPressMembers={fn()}
      onPressShare={fn()}
      onPressRename={fn()}
      onPressEnd={fn()}
      onPressLeave={fn()}
    >
      {props.children}
    </SpaceDetailScreenView>
  );
}

function RouteBody(props: {
  readonly route: StoryRoute;
  readonly children: JSX.Element;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={props.route.spaceBody}
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
      <SpaceBody>{props.children}</SpaceBody>
    </Show>
  );
}

function StoryFrame(props: {
  readonly story: () => JSX.Element;
  readonly asRail: boolean;
  readonly route: StoryRoute;
}): JSX.Element {
  const screen = children(() => props.story());
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
          <RouteBody route={props.route}>{screen()}</RouteBody>
        </AppFrame>
      }
    >
      <AppFrame rail={screen()}>{null}</AppFrame>
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
  return (
    <AppFrameChromeProvider globalTrailing={<AccountMenu />}>
      <StoryFrame
        story={props.story}
        asRail={props.asRail}
        route={storyRoute(props.id, props.route)}
      />
    </AppFrameChromeProvider>
  );
}
