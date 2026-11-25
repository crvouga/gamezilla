import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { List } from '@pkgs/ui-root-client-ts/list';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';
import { For, Match, Show, Switch } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar, SpacePersonName } from './space-person-view';

export type SpaceShareSheetViewProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Copies the space link; the button shows copying / copied / failed. */
  readonly onCopyLink: () => Promise<void>;
  /** The host may add and remove people. */
  readonly canManage: boolean;
  /** The add-people search, shown while `canManage`. */
  readonly addPeople?: JSX.Element;
  /** Whether the people with access are still being read. */
  readonly peopleStatus: 'loading' | 'ready';
  /** People with access, host included. */
  readonly people: readonly SpacePerson[];
  readonly hostId: string | null;
  /** The viewer's own id: their row reads "You". */
  readonly viewerId?: string | undefined;
  readonly onRemovePerson: (person: SpacePerson) => void;
  /** A confirm the sheet owns, such as removing a person. */
  readonly overlay?: JSX.Element;
};

function SpaceShareLinkSection(props: {
  readonly onCopyLink: () => Promise<void>;
  /** The viewer hosts: the link works while they are online. */
  readonly youHost: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const copyButton = useMutationButton({
    operation: () => props.onCopyLink(),
    labels: {
      idle: t`Copy link`,
      loading: t`Copying…`,
      success: t`Copied`,
      error: t`Couldn't copy`,
    },
  });
  return (
    <StackVertical gap="sm">
      <H3 size="label">
        <Trans>Invite with a link</Trans>
      </H3>
      <P variant="caption">
        <Show
          when={props.youHost}
          fallback={
            <Trans>
              Anyone with the link can join while the host is online.
            </Trans>
          }
        >
          <Trans>Anyone with the link can join while you're online.</Trans>
        </Show>
      </P>
      <Button {...copyButton.buttonProps} />
    </StackVertical>
  );
}

function SpaceShareUserRow(props: {
  readonly person: SpacePerson;
  readonly trailing: JSX.Element | null;
  /** The viewer's own row: "You", as People and Join say it. */
  readonly you?: boolean | undefined;
}): JSX.Element {
  return (
    <StackHorizontal
      align="center"
      gap="md"
      paddingX="lg"
      paddingY="sm"
      minHeight="row"
    >
      <SpacePersonAvatar person={props.person} size={40} />
      <StackVertical grow shrink>
        <Show
          when={props.you === true}
          fallback={
            <SpacePersonName
              person={props.person}
              variant="rowTitle"
              lines={1}
            />
          }
        >
          <P variant="rowTitle" lines={1}>
            <Trans>You</Trans>
          </P>
        </Show>
      </StackVertical>
      <StackHorizontal align="center">{props.trailing}</StackHorizontal>
    </StackHorizontal>
  );
}

function PeopleAccessRow(props: {
  readonly person: SpacePerson;
  readonly you: boolean;
  readonly isHost: boolean;
  readonly canManage: boolean;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <Switch
      fallback={
        <SpaceShareUserRow
          person={props.person}
          you={props.you}
          trailing={null}
        />
      }
    >
      <Match when={props.isHost}>
        <SpaceShareUserRow
          person={props.person}
          you={props.you}
          trailing={<HostBadge size="sm" />}
        />
      </Match>
      <Match when={props.canManage}>
        <SpaceShareUserRow
          person={props.person}
          trailing={
            <Button
              onClick={() => props.onRemove()}
              size="sm"
              intent="neutral"
              variant="outline"
              dataSet={{ testid: Handles.spaceRemovePerson(props.person.id) }}
              title={<Trans>Remove</Trans>}
            />
          }
        />
      </Match>
    </Switch>
  );
}

function SpaceSharePeopleList(props: SpaceShareSheetViewProps): JSX.Element {
  return (
    <StackVertical gap="sm">
      <H3 size="label">
        <Trans>People with access</Trans>
      </H3>
      <P variant="caption">
        <Show
          when={props.canManage}
          fallback={
            <Trans>
              People the host adds find this space in Spaces, under Shared with
              you.
            </Trans>
          }
        >
          <Trans>
            People you add find this space in Spaces, under Shared with you.
          </Trans>
        </Show>
      </P>
      <Show when={props.peopleStatus === 'loading'}>
        <LoadingState
          variant="compact"
          size="sm"
          caption={<Trans>Loading people…</Trans>}
        />
      </Show>
      <Show when={props.people.length > 0}>
        <List>
          <For each={props.people}>
            {(person) => (
              <PeopleAccessRow
                person={person}
                you={props.viewerId === person.id}
                isHost={props.hostId === person.id}
                canManage={props.canManage}
                onRemove={() => props.onRemovePerson(person)}
              />
            )}
          </For>
        </List>
      </Show>
      {/* Only the host so far: their row stays, the invitation under it. */}
      <Show
        when={
          props.peopleStatus === 'ready' &&
          props.people.every((person) => person.id === props.hostId)
        }
      >
        <EmptyState
          variant="compact"
          title={<Trans>No one added yet</Trans>}
          body={<Trans>Copy the link above to invite people.</Trans>}
        />
      </Show>
    </StackVertical>
  );
}

/**
 * Share a space: copy its link, add people (host), and see who has access
 * with the host's Remove action. A bottom sheet on phones, a modal on wider
 * screens.
 */
export function SpaceShareSheetView(
  props: SpaceShareSheetViewProps
): JSX.Element {
  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={() => props.onClose()}
      title={<Trans>Share space</Trans>}
      size="medium"
      closeDataSet={{ testid: Handles.spaceShareClose }}
    >
      {/* The sheet grows with the window and scrolls as one, so the people
          list is never cut mid-row while the window has room. */}
      <StackVertical gap="md">
        <SpaceShareLinkSection
          onCopyLink={props.onCopyLink}
          youHost={
            props.viewerId !== undefined && props.viewerId === props.hostId
          }
        />
        <Show when={props.canManage}>{props.addPeople}</Show>
        <SpaceSharePeopleList {...props} />
        {props.overlay}
      </StackVertical>
    </ResponsiveSurface>
  );
}
