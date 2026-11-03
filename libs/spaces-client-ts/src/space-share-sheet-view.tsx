import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { List } from '@pkgs/ui-root-client-ts/list';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
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
  readonly onRemovePerson: (person: SpacePerson) => void;
  /** A confirm the sheet owns, such as removing a person. */
  readonly overlay?: JSX.Element;
};

function SpaceShareLinkSection(props: {
  readonly onCopyLink: () => Promise<void>;
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
        <Trans>Link</Trans>
      </H3>
      <Button {...copyButton.buttonProps} />
    </StackVertical>
  );
}

function SpaceShareUserRow(props: {
  readonly person: SpacePerson;
  readonly trailing: JSX.Element | null;
}): JSX.Element {
  return (
    <StackHorizontal
      align="center"
      gap="md"
      paddingX="lg"
      paddingY="sm"
      minHeight="row"
    >
      <SpacePersonAvatar person={props.person} size={44} />
      <StackVertical grow>
        <SpacePersonName person={props.person} variant="bodyBold" lines={1} />
      </StackVertical>
      {props.trailing}
    </StackHorizontal>
  );
}

function PeopleAccessRow(props: {
  readonly person: SpacePerson;
  readonly isHost: boolean;
  readonly canManage: boolean;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <Switch
      fallback={<SpaceShareUserRow person={props.person} trailing={null} />}
    >
      <Match when={props.isHost}>
        <SpaceShareUserRow
          person={props.person}
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
        <Trans>
          Added people find this space in their lobby and choose Join. Anyone
          with the space link can also join.
        </Trans>
      </P>
      <Show when={props.peopleStatus === 'loading'}>
        <LoadingState variant="compact" size="sm" />
      </Show>
      <Show when={props.peopleStatus === 'ready' && props.people.length === 0}>
        <EmptyState
          variant="compact"
          title={<Trans>No one added yet</Trans>}
          body={<Trans>Share the space link to invite people.</Trans>}
        />
      </Show>
      <Show when={props.people.length > 0}>
        <List>
          <For each={props.people}>
            {(person) => (
              <PeopleAccessRow
                person={person}
                isHost={props.hostId === person.id}
                canManage={props.canManage}
                onRemove={() => props.onRemovePerson(person)}
              />
            )}
          </For>
        </List>
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
      scroll={false}
      closeDataSet={{ testid: Handles.spaceShareClose }}
    >
      <ScrollView maxHeight="lg" gap="md">
        <SpaceShareLinkSection onCopyLink={props.onCopyLink} />
        <Show when={props.canManage}>{props.addPeople}</Show>
        <SpaceSharePeopleList {...props} />
        {props.overlay}
      </ScrollView>
    </ResponsiveSurface>
  );
}
