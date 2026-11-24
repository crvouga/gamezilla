import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { byContentId } from './use-content-pages';

/** One kept copy of a draft, as its row tells it apart from the others. */
export type ContentAuthorCopy = {
  readonly id: string;
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
  /** Different work kept from another device. */
  readonly conflicted: boolean;
  readonly validation: ContentDraft['validation_status'];
};

/**
 * What sets a copy apart, under its title: where it was kept and its check
 * on one line, then its details on their own quieter line.
 */
function CopyCaption(props: {
  copy: ContentAuthorCopy;
  /** The copy being edited, said first. */
  current: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const details = () =>
    [props.copy.difficulty.trim(), props.copy.description.trim()]
      .filter((part) => part !== '')
      .join(' · ');
  return (
    <StackVertical gap="xs">
      <Text variant="inherit" tone="default">
        <Show when={props.current}>
          <Text variant="inherit" tone="tint">
            {t`Editing now`}
          </Text>
          {' · '}
        </Show>
        {props.copy.conflicted
          ? t`Kept from another device`
          : t`Kept on this device`}
        {' · '}
        {
          {
            valid: t`passed its check`,
            invalid: t`needs changes`,
            unchecked: t`not checked yet`,
          }[props.copy.validation]
        }
      </Text>
      <Show when={details() !== ''}>
        <Text variant="inherit" tone="secondary" lines={2}>
          {details()}
        </Text>
      </Show>
    </StackVertical>
  );
}

/**
 * The draft's kept copies, presentational: each by its title, then where
 * it was kept, whether it passed its check and its details, so copies can
 * be told apart before one is chosen; the one being edited is marked.
 */
export function ContentAuthorCopiesListView(props: {
  copies: readonly ContentAuthorCopy[];
  currentId: string;
  disabled: boolean;
  /** Asks to keep working from the copy `draftId`. */
  onSelect: (draftId: string) => void;
  /** More copies to read, a page at a time. */
  more?: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
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
        <For each={props.copies}>
          {(copy) => (
            <MenuRow
              title={copy.title || t`Untitled draft`}
              caption={
                <CopyCaption
                  copy={copy}
                  current={copy.id === props.currentId}
                />
              }
              selected={copy.id === props.currentId}
              value={copy.id === props.currentId ? undefined : t`Use copy`}
              disabled={props.disabled && copy.id !== props.currentId}
              // The copy being edited is marked, not offered.
              onClick={
                copy.id === props.currentId
                  ? undefined
                  : () => props.onSelect(copy.id)
              }
              dataSet={{ testid: `content-use-copy-${copy.id}` }}
            />
          )}
        </For>
      </MenuSection>
      {props.more}
    </>
  );
}

/**
 * The draft's kept copies, a page at a time, the one being edited marked.
 * Choosing another asks first; the builder's shell owns that dialog.
 */
export function ContentAuthorCopiesList(props: {
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
  const shown = createMemo((): ContentAuthorCopy[] =>
    [
      ...new Set([
        ...copies()
          .toSorted(byContentId)
          .slice(0, data.pages.drafts.limit())
          .map((draft) => draft.id),
        props.currentId,
      ]),
    ].map((id) => {
      const draft = copies().find((entry) => entry.id === id);
      return {
        id,
        title: draft?.title ?? '',
        difficulty: draft?.difficulty ?? '',
        description: draft?.description ?? '',
        conflicted: draft?.conflicted ?? false,
        validation: draft?.validation_status ?? 'unchecked',
      };
    })
  );
  return (
    <ContentAuthorCopiesListView
      copies={shown()}
      currentId={props.currentId}
      disabled={props.disabled}
      onSelect={props.onSelect}
      more={
        <ContentLoadMore
          page={data.pages.drafts}
          label={t`Load more draft copies`}
          disabled={props.disabled}
        />
      }
    />
  );
}

/** The confirm before the draft continues from another kept copy. */
export function ContentCopyConfirm(props: {
  visible: boolean;
  /** The chosen copy's title, named in the question. */
  title: string;
  disabled: boolean;
  onClose: () => void;
  /** Makes the chosen copy the working draft; rejects with what to say. */
  onChoose: () => Promise<void>;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.visible}
      onClose={() => props.onClose()}
      title={
        props.title.trim() === '' ? (
          <Trans>Keep working from this copy?</Trans>
        ) : (
          <Trans>Keep working from “{props.title.trim()}”?</Trans>
        )
      }
      message={
        <Trans>
          Your draft will continue from this copy. The copy you are editing now
          and your other draft copies stay saved.
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
