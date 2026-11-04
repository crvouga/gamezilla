import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client-ts/screen-body-scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo, Index, Show } from 'solid-js';
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
  readonly onCreateSpace: () => void;
  readonly onOpenSpace: (spaceId: string) => void;
};

function SpacesEmptyState(props: {
  readonly onCreateSpace: () => void;
}): JSX.Element {
  return (
    <EmptyState
      icon={Gamepad2Icon}
      title={<Trans>No spaces yet</Trans>}
      body={
        <Trans>
          Start a space to play with friends. Spaces you join show up here.
        </Trans>
      }
      action={{
        label: <Trans>Start a space</Trans>,
        onClick: () => props.onCreateSpace(),
      }}
    />
  );
}

/** "Hosting 2 spaces": the label of the viewer's own group. */
function SpacesHostingCount(props: { readonly count: number }): JSX.Element {
  return (
    <Text variant="sectionLabel" testId={Handles.spacesHostingCount}>
      <Plural
        value={props.count}
        one="Hosting # space"
        other="Hosting # spaces"
      />
    </Text>
  );
}

/** One group of the lobby: its label above one panel of space rows. */
function SpacesGroup(props: {
  readonly title: JSX.Element;
  readonly spaces: readonly SpaceCardData[];
  readonly onOpenSpace: (spaceId: string) => void;
}): JSX.Element {
  return (
    <MenuSection title={props.title}>
      <Index each={props.spaces}>
        {(space) => (
          <SpaceCardView
            space={space()}
            onOpen={() => props.onOpenSpace(space().spaceId)}
          />
        )}
      </Index>
    </MenuSection>
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
          <StackVertical paddingX="lg">
            <SpacesHostingCount count={props.count} />
          </StackVertical>
        </Show>
      }
    >
      <SpacesGroup
        title={title()}
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
          <LoadingState />
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
              <SpacesEmptyState onCreateSpace={props.onCreateSpace} />
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
