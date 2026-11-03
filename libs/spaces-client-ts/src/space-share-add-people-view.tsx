import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import type { ComboboxOption } from '@pkgs/ui-root-shared-ts/combobox-types';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';

/** The last addition: none yet, in flight, done, or refused with why. */
export type SpaceAddition =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'success'; readonly name: string }
  | { readonly status: 'error'; readonly message: string };

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
  const success = () =>
    props.addition.status === 'success' ? props.addition : null;
  const failure = () =>
    props.addition.status === 'error' ? props.addition : null;
  return (
    <>
      <Show when={success()}>
        {(added) => (
          <SuccessState
            variant="compact"
            title={<Trans>{added().name} added</Trans>}
            body={
              <Trans>
                They can find this space in their lobby and choose Join.
              </Trans>
            }
            dataSet={{ testid: Handles.spaceAddSuccess }}
          />
        )}
      </Show>
      <Show when={failure()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={<Trans>Couldn't add person</Trans>}
            body={error().message}
            retry={{ onClick: () => props.onRetry() }}
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
  return (
    <StackVertical gap="sm">
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
      {props.searchDenied}
      <SpaceAdditionState addition={props.addition} onRetry={props.onRetry} />
    </StackVertical>
  );
}
