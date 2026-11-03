import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import { List } from '@pkgs/ui-root-client-ts/list';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client-ts/screen-body-scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Index, Show } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import { SpaceCardView } from './space-card-view';

/** The lobby is still reading, or has answered. */
export type SpacesLobbyStatus = 'loading' | 'ready';

export type SpacesLobbyViewProps = {
  /** `ready` only once the hosted count and the list have both answered. */
  readonly status: SpacesLobbyStatus;
  /** Live spaces the viewer hosts; shown as "Hosting N spaces" when any. */
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

/** "Hosting 2 spaces" while the viewer hosts any. */
function SpacesHostingCount(props: { readonly count: number }): JSX.Element {
  return (
    <Show when={props.count > 0}>
      <P variant="caption" testId={Handles.spacesHostingCount}>
        <Plural
          value={props.count}
          one="Hosting # space"
          other="Hosting # spaces"
        />
      </P>
    </Show>
  );
}

/**
 * The lobby body: what the viewer hosts, then the spaces they can join. It
 * is loading until it has answered — never "No spaces yet" before then,
 * because an empty lobby is an answer, not a guess.
 */
export function SpacesLobbyView(props: SpacesLobbyViewProps): JSX.Element {
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
        <SpacesHostingCount count={props.hostedCount} />
        <Show
          when={props.spaces.length > 0}
          fallback={<SpacesEmptyState onCreateSpace={props.onCreateSpace} />}
        >
          <ScreenBodyScrollView paddingBottom="xl">
            <List>
              <Index each={props.spaces}>
                {(space) => (
                  <SpaceCardView
                    space={space()}
                    onOpen={() => props.onOpenSpace(space().spaceId)}
                  />
                )}
              </Index>
            </List>
          </ScreenBodyScrollView>
        </Show>
      </StackVertical>
    </Show>
  );
}
