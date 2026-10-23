import { choosePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/choose-content-draft-mutation';
import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createMemo, createSignal, For, type JSX } from 'solid-js';
import { useContentLibraryState } from './content-library-context';

type Choice = {
  readonly source: ContentDraft;
  readonly expected: string;
  readonly draftId: string;
};

export function ContentKeptCopies(props: {
  document: ContentDocument;
  disabled: boolean;
  currentId: string;
  onChoose: (draft: ContentDraft) => void;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [choice, setChoice] = createSignal<Choice | null>(null);
  const copies = createMemo(() =>
    data
      .content()
      .drafts.filter((draft) => draft.document_id === props.document.id)
  );
  const ids = createMemo(() => copies().map((draft) => draft.id));
  const select = (id: string): void => {
    const source = copies().find((draft) => draft.id === id);
    if (source !== undefined)
      setChoice({
        source,
        expected: props.document.working_draft_id,
        draftId: createId(),
      });
  };
  const choose = async (): Promise<void> => {
    const selected = choice();
    if (selected === null) return;
    const result = await mutations.mutate(choosePuzzleContentDraftMutation, {
      documentId: props.document.id,
      chosenDraftId: selected.source.id,
      expectedDraftId: selected.expected,
      draftId: selected.draftId,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The working draft changed. Open the kept copies and choose again.`
      );
    props.onChoose({
      ...selected.source,
      id: selected.draftId,
      parent_id: selected.source.id,
      conflicted: false,
    });
  };
  return (
    <>
      <MenuSection
        title={<Trans>Kept copies</Trans>}
        footer={
          <Trans>
            Choosing a copy keeps earlier work and leaves published editions
            unchanged.
          </Trans>
        }
      >
        <For each={ids()}>
          {(id) => (
            <MenuRow
              title={
                (copies().find((draft) => draft.id === id)?.title ?? '') ||
                t`Untitled draft`
              }
              caption={
                copies().find((draft) => draft.id === id)?.conflicted
                  ? t`Different work was kept from another device`
                  : t`Saved draft copy`
              }
              selected={id === props.currentId}
              value={id === props.currentId ? t`Current` : t`Use copy`}
              disabled={props.disabled || id === props.currentId}
              onClick={() => select(id)}
              dataSet={{ testid: `content-use-copy-${id}` }}
            />
          )}
        </For>
      </MenuSection>
      <MutationModal
        visible={choice() !== null}
        onClose={() => setChoice(null)}
        title={<Trans>Use this kept copy?</Trans>}
        message={
          <Trans>
            A new working copy will use these details. Your other saved copies
            remain available.
          </Trans>
        }
        operation={choose}
        submitLabel={<Trans>Use copy</Trans>}
        successTitle={<Trans>Working copy chosen</Trans>}
        submitDisabled={props.disabled}
      />
    </>
  );
}
