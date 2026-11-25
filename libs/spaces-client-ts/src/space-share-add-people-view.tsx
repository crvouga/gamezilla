import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import type { ComboboxOption } from '@pkgs/ui-root-shared-ts/combobox-types';
import type { JSX } from '@solidjs/web';
import { children, createMemo, Show } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';

/** The last addition: none yet, in flight, done, or refused with why. */
export type SpaceAddition =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'success'; readonly name: string }
  | {
      readonly status: 'error';
      readonly message: string;
      /** Who the refused addition was for, so Try again names them. */
      readonly name?: string | undefined;
    };

/** A person the search offers, with the handle typed text matches. */
export type SpaceAddCandidate = SpacePerson & {
  /** The stored username, which what was typed is matched against. */
  readonly searchText: string;
};

export type SpaceShareAddPeopleViewProps = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** People to offer, already without those who have access. */
  readonly candidates: readonly SpaceAddCandidate[];
  /** The people search is still answering. */
  readonly searching: boolean;
  readonly addition: SpaceAddition;
  /** Shown instead of results when the viewer may not search people. */
  readonly searchDenied?: JSX.Element;
  readonly onPick: (person: SpaceAddCandidate) => void;
  /** Tries the last refused addition again. */
  readonly onRetry: () => void;
};

function SpaceAdditionState(props: {
  readonly addition: SpaceAddition;
  readonly onRetry: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const success = () =>
    props.addition.status === 'success' ? props.addition : null;
  const failure = () =>
    props.addition.status === 'error' ? props.addition : null;
  // A done add comes and goes: it floats over the sheet, and the person's
  // row in the list is the lasting record. A refused one is the search
  // field's own result: it stays under the field, with Try again, inside the
  // dialog where the person is working.
  return (
    <>
      <ToastStack placement="dialog">
        <Show when={success()}>
          {(added) => (
            <SuccessState
              variant="compact"
              title={<Trans>{added().name} added</Trans>}
              dataSet={{ testid: Handles.spaceAddSuccess }}
            />
          )}
        </Show>
      </ToastStack>
      <Show when={failure()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={
              <Show
                when={error().name}
                fallback={<Trans>Couldn't add person</Trans>}
              >
                {(name) => <Trans>Couldn't add {name()}</Trans>}
              </Show>
            }
            body={error().message}
            // Worded as every other way to try again in the app.
            retry={{ label: t`Try again`, onClick: () => props.onRetry() }}
          />
        )}
      </Show>
    </>
  );
}

/** The host's people search in the share sheet, and how the last add went. */
export function SpaceShareAddPeopleView(
  props: SpaceShareAddPeopleViewProps
): JSX.Element {
  const { t } = useLingui();
  const options = createMemo((): ComboboxOption[] =>
    props.candidates.map((person) => ({
      value: person.id,
      label: person.name,
      searchText: person.searchText,
      dataSet: { testid: Handles.spaceAddPerson(person.id) },
      preview: <SpacePersonAvatar person={person} size={32} />,
    }))
  );
  const emptyMessage = (): JSX.Element | undefined =>
    props.query.trim().length > 0 && !props.searching ? (
      <Trans>No people found</Trans>
    ) : undefined;
  const onValueChange = (id: string): void => {
    const person = props.candidates.find((candidate) => candidate.id === id);
    if (person !== undefined) props.onPick(person);
  };
  // Search refused (sign in first): its prompt takes the field's place, so
  // nothing looks usable that is not.
  const denied = children(() => props.searchDenied);
  const searchAllowed = (): boolean =>
    !denied.toArray().some((node) => node !== null && node !== undefined);
  return (
    <StackVertical gap="sm">
      <Show when={searchAllowed()} fallback={denied()}>
        <Combobox
          label={t`Add people`}
          surfaceTitle={<Trans>Add people</Trans>}
          options={options()}
          onValueChange={onValueChange}
          query={props.query}
          onQueryChange={(query) => props.onQueryChange(query)}
          filterOption={() => true}
          placeholder={t`Search by username`}
          searchPlaceholder={t`Search by username`}
          loading={props.searching && options().length === 0}
          disabled={props.addition.status === 'loading'}
          emptyMessage={emptyMessage()}
          triggerDataSet={{ testid: Handles.spaceAddTrigger }}
          searchDataSet={{ testid: Handles.spaceAddQuery }}
        />
      </Show>
      <SpaceAdditionState addition={props.addition} onRetry={props.onRetry} />
    </StackVertical>
  );
}
