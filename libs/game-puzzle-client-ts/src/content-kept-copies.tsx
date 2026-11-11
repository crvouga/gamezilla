import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createMemo, For, type JSX } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { byContentId } from './use-content-pages';

/**
 * The draft's kept copies, a page at a time, the one being edited marked.
 * Choosing another asks first; the builder's shell owns that dialog.
 */
export function ContentKeptCopies(props: {
  document: ContentDocument;
  disabled: boolean;
  currentId: string;
  /** Asks to keep working from the copy `draftId`. */
  onSelect: (draftId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const copies = createMemo(() =>
    data
      .content()
      .drafts.filter((draft) => draft.document_id === props.document.id)
  );
  const ids = createMemo(() => [
    ...new Set([
      ...copies()
        .toSorted(byContentId)
        .slice(0, data.pages.drafts.limit())
        .map((draft) => draft.id),
      props.currentId,
    ]),
  ]);
  return (
    <>
      <MenuSection
        title={<Trans>Draft copies</Trans>}
        footer={
          <Trans>
            Each save keeps a copy of this draft. Choose one to keep working
            from it; the others stay saved, and published editions do not
            change.
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
              value={id === props.currentId ? t`Editing now` : t`Use copy`}
              disabled={props.disabled || id === props.currentId}
              onClick={() => props.onSelect(id)}
              dataSet={{ testid: `content-use-copy-${id}` }}
            />
          )}
        </For>
      </MenuSection>
      <ContentLoadMore
        page={data.pages.drafts}
        label={t`Load more draft copies`}
        disabled={props.disabled}
      />
    </>
  );
}

/** The confirm before the draft continues from another kept copy. */
export function ContentCopyConfirm(props: {
  visible: boolean;
  disabled: boolean;
  onClose: () => void;
  /** Makes the chosen copy the working draft; rejects with what to say. */
  onChoose: () => Promise<void>;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.visible}
      onClose={() => props.onClose()}
      title={<Trans>Keep working from this copy?</Trans>}
      message={
        <Trans>
          Your draft will continue from this copy. Your other draft copies stay
          saved.
        </Trans>
      }
      operation={() => props.onChoose()}
      submitLabel={<Trans>Use copy</Trans>}
      successTitle={<Trans>Working copy chosen</Trans>}
      submitDisabled={props.disabled}
      submitDataSet={{ testid: 'content-use-copy-confirm' }}
      dismissDataSet={{ testid: 'content-use-copy-dismiss' }}
    />
  );
}
