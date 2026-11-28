import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { GamesArt } from '@pkgs/ui-root-client-ts/illustration';

import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client-ts/screen-body-scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import { SpaceCardTileView } from './space-card-tile-view';
import type { SpaceCardData } from './space-card-view';
import { SpaceCardView } from './space-card-view';

/** The lobby is still reading, or has answered. */
export type SpacesLobbyStatus = 'loading' | 'ready';

export type SpacesLobbyViewProps = {
  /** `ready` only once the hosted count and the list have both answered. */
  readonly status: SpacesLobbyStatus;
  /** Live spaces the viewer hosts; labels their group "Hosting N spaces". */
  readonly hostedCount: number;
  /** Spaces to show, open-on-this-device first. */
  readonly spaces: readonly SpaceCardData[];
  readonly onOpenSpace: (spaceId: string) => void;
};

/**
 * Nothing to list yet. The screen's own New space (the header's button, a
 * phone's floating one) is the one way to start: the empty state says where
 * it is rather than offering a second button beside it.
 */
function SpacesEmptyState(): JSX.Element {
  return (
    <EmptyState
      icon={GamesArt}
      title={<Trans>No spaces yet</Trans>}
      body={
        <Trans>
          Start one with New space and invite friends to play. Spaces friends
          share with you show up here too.
        </Trans>
      }
    />
  );
}

/** "Hosting 2 spaces": the title of the viewer's own group. */
function SpacesHostingCount(props: { readonly count: number }): JSX.Element {
  return (
    <Plural
      value={props.count}
      one="Hosting # space"
      other="Hosting # spaces"
    />
  );
}

/**
 * A group's title over its cards, on the page's own edge (the edge the
 * screen's title starts on), at the size every page's section titles take
 * ("Needs you", "Who's here"): never a faint eyebrow over the cards.
 */
function SpacesGroupHeading(props: {
  readonly title: JSX.Element;
  readonly testId?: string | undefined;
}): JSX.Element {
  return (
    <H2 size="subtitle" lines={1} testId={props.testId}>
      {props.title}
    </H2>
  );
}

/**
 * A group's cards two by two, each one column wide: a lone card, or the
 * last of an odd group, keeps its column on the page's leading edge
 * instead of stretching across the page.
 */
function SpacesCardGrid(props: {
  readonly spaces: readonly SpaceCardData[];
  readonly onOpenSpace: (spaceId: string) => void;
}): JSX.Element {
  return (
    <Grid columns={2} gap="md">
      <For keyed={false} each={props.spaces}>
        {(space) => (
          <SpaceCardTileView
            space={space()}
            onOpen={() => props.onOpenSpace(space().spaceId)}
          />
        )}
      </For>
    </Grid>
  );
}

/**
 * One group of the lobby: its label above one panel of space rows, or on
 * desktop above a two-column grid of cards, so the page uses its width for
 * the faces of who is in each space instead of stretching rows.
 */
function SpacesGroup(props: {
  readonly title: JSX.Element;
  readonly titleTestId?: string | undefined;
  readonly spaces: readonly SpaceCardData[];
  readonly onOpenSpace: (spaceId: string) => void;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <StackVertical gap="sm">
      <SpacesGroupHeading title={props.title} testId={props.titleTestId} />
      <Show
        when={mode() === 'wide'}
        fallback={
          <MenuSection>
            <For keyed={false} each={props.spaces}>
              {(space) => (
                <SpaceCardView
                  space={space()}
                  onOpen={() => props.onOpenSpace(space().spaceId)}
                />
              )}
            </For>
          </MenuSection>
        }
      >
        <SpacesCardGrid spaces={props.spaces} onOpenSpace={props.onOpenSpace} />
      </Show>
    </StackVertical>
  );
}

/**
 * The spaces the viewer hosts, under "Hosting N spaces". While the count has
 * answered but no hosted card has (a card waits on its host), the label
 * still says how many the viewer hosts.
 */
function HostedSpaces(props: {
  readonly count: number;
  readonly spaces: readonly SpaceCardData[];
  readonly onOpenSpace: (spaceId: string) => void;
}): JSX.Element {
  const title = (): JSX.Element =>
    props.count > 0 ? (
      <SpacesHostingCount count={props.count} />
    ) : (
      <Trans>Your spaces</Trans>
    );
  return (
    <Show
      when={props.spaces.length > 0}
      fallback={
        <Show when={props.count > 0}>
          <SpacesGroupHeading
            title={<SpacesHostingCount count={props.count} />}
            testId={Handles.spacesHostingCount}
          />
        </Show>
      }
    >
      <SpacesGroup
        title={title()}
        titleTestId={props.count > 0 ? Handles.spacesHostingCount : undefined}
        spaces={props.spaces}
        onOpenSpace={props.onOpenSpace}
      />
    </Show>
  );
}

/**
 * The lobby body: the spaces the viewer hosts in their own group, then the
 * spaces shared with them (a friend's live space, one they were added to),
 * each group its own panel. It is loading until it has answered — never
 * "No spaces yet" before then, because an empty lobby is an answer, not a
 * guess.
 */
export function SpacesLobbyView(props: SpacesLobbyViewProps): JSX.Element {
  const hosted = createMemo(() =>
    props.spaces.filter((space) => space.hostedByViewer)
  );
  const shared = createMemo(() =>
    props.spaces.filter((space) => !space.hostedByViewer)
  );
  return (
    <Show
      when={props.status === 'ready'}
      fallback={
        <StackVertical grow gap="md">
          <LoadingState caption={<Trans>Loading your spaces…</Trans>} />
        </StackVertical>
      }
    >
      <StackVertical grow gap="md" testId={Handles.spacesListReady}>
        <Show
          when={props.spaces.length > 0}
          fallback={
            <>
              <HostedSpaces
                count={props.hostedCount}
                spaces={[]}
                onOpenSpace={props.onOpenSpace}
              />
              <SpacesEmptyState />
            </>
          }
        >
          <ScreenBodyScrollView paddingBottom="xl">
            <StackVertical gap="xl">
              <HostedSpaces
                count={props.hostedCount}
                spaces={hosted()}
                onOpenSpace={props.onOpenSpace}
              />
              <Show when={shared().length > 0}>
                <SpacesGroup
                  title={<Trans>Shared with you</Trans>}
                  spaces={shared()}
                  onOpenSpace={props.onOpenSpace}
                />
              </Show>
            </StackVertical>
          </ScreenBodyScrollView>
        </Show>
      </StackVertical>
    </Show>
  );
}
